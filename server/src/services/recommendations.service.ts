import crypto from "node:crypto";
import { supabaseAdmin } from "../config/supabase";
import { listAllBusinesses, listAllProcedures, type ProcedureRow } from "./careCatalog.service";
import { daysElapsedSince, getLatestCareRecord, listRecentCareRecords } from "./careRecords.service";

const DISCLAIMER = "의료적 진단이 아니며 최종 관리는 전문가 상담 후 결정하세요.";
const RECENT_CARES_FOR_MATCH = 10; // 최근 시술 이력에서 categoryTags를 뽑아 연관성 가중치를 매길 때 볼 개수
const RELATED_CARES_LIMIT = 3;
const SIMILAR_PROCEDURES_LIMIT = 3;

// 2026-08-17 — docs/care_recommendation_data_guide.md 설계로 교체 (기존엔 고객이 "이미 보유한
// 이용권(memberships.availableCareNames)" 안에서만 추천 후보를 골랐음). 이제는 실제 사업장 전체
// 시술 카탈로그(procedures, 46건) 중 고객의 관심목표(interest_goals)와 category_tags가 겹치는
// 시술을 추천한다 — 안 받아본 시술/다른 사업장 시술도 후보가 될 수 있다.
function recommendationIdFor(userId: string): string {
  const hash = crypto.createHash("sha1").update(`recommendation:${userId}`).digest("hex");
  return `R-${hash.slice(0, 8)}`;
}

async function getInterestGoals(userId: string): Promise<string[]> {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("interest_goals")
    .eq("user_id", userId)
    .maybeSingle();
  return (data?.interest_goals as string[]) ?? [];
}

interface ScoredProcedure {
  procedure: ProcedureRow;
  goalOverlap: string[];
  recentRelevance: number;
}

function scoreProcedures(
  candidates: ProcedureRow[],
  goalSet: Set<string>,
  recentTagCounts: Map<string, number>,
): ScoredProcedure[] {
  return candidates
    .map((procedure) => {
      const goalOverlap = procedure.category_tags.filter((tag) => goalSet.has(tag));
      const recentRelevance = procedure.category_tags.reduce((sum, tag) => sum + (recentTagCounts.get(tag) ?? 0), 0);
      return { procedure, goalOverlap, recentRelevance };
    })
    .filter((s) => s.goalOverlap.length > 0 || s.recentRelevance > 0)
    .sort((a, b) => b.goalOverlap.length - a.goalOverlap.length || b.recentRelevance - a.recentRelevance);
}

export async function computeNextCareRecommendation(userId: string) {
  const latestCare = await getLatestCareRecord(userId);
  if (!latestCare) return null;

  const [goals, recentCares, allProcedures] = await Promise.all([
    getInterestGoals(userId),
    listRecentCareRecords(userId, RECENT_CARES_FOR_MATCH),
    listAllProcedures(),
  ]);

  const nameToProcedure = new Map(allProcedures.map((p) => [p.name, p]));
  const receivedNames = new Set(recentCares.map((r) => r.care_name));

  // 최근 받은 시술들의 categoryTags 빈도 — "최근 시술과의 연관성" 가중치용
  const recentTagCounts = new Map<string, number>();
  for (const care of recentCares) {
    const procedure = nameToProcedure.get(care.care_name);
    if (!procedure) continue;
    for (const tag of procedure.category_tags) recentTagCounts.set(tag, (recentTagCounts.get(tag) ?? 0) + 1);
  }

  const goalSet = new Set(goals);
  const candidates = allProcedures.filter((p) => !receivedNames.has(p.name));
  const scored = scoreProcedures(candidates, goalSet, recentTagCounts);
  const top = scored[0];
  if (!top) return null;

  const basis: string[] = ["catalog"];
  const reasons: string[] = [];
  if (top.goalOverlap.length > 0) {
    basis.push("goal");
    reasons.push(`관심 목표(${top.goalOverlap.join(", ")})에 도움이 돼요.`);
  }
  if (top.recentRelevance > 0) {
    basis.push("recentCare");
    reasons.push(`최근 관리(${latestCare.care_name})와 연관된 관리예요.`);
  }
  if (reasons.length === 0) {
    reasons.push(`최근 관리(${latestCare.care_name}) 이후 다음 관리를 준비할 시기입니다.`);
  }

  return {
    recommendationId: recommendationIdFor(userId),
    careName: top.procedure.name,
    businessId: top.procedure.business_id,
    reasons,
    basis,
    disclaimer: DISCLAIMER,
  };
}

export async function getNextCareRecommendationDetail(userId: string, recommendationId: string) {
  const recommendation = await computeNextCareRecommendation(userId);
  if (!recommendation || recommendation.recommendationId !== recommendationId) return null;

  const [recentCares, allProcedures, allBusinesses] = await Promise.all([
    listRecentCareRecords(userId, RELATED_CARES_LIMIT),
    listAllProcedures(),
    listAllBusinesses(),
  ]);

  const relatedRecentCares = recentCares.map((row) => ({
    careRecordId: row.id,
    careName: row.care_name,
    daysElapsed: daysElapsedSince(row.care_date),
  }));

  const recommendedProcedure = allProcedures.find((p) => p.name === recommendation.careName);
  const recommendedTags = new Set(recommendedProcedure?.category_tags ?? []);

  // "비슷한 고민의 다른 관리" — 추천된 시술과 category_tags를 공유하는 다른 시술 후보
  const popularWithSimilarCustomers = allProcedures
    .filter((p) => p.name !== recommendation.careName && p.category_tags.some((tag) => recommendedTags.has(tag)))
    .slice(0, SIMILAR_PROCEDURES_LIMIT)
    .map((p) => p.name);

  const business = allBusinesses.find((b) => b.id === recommendation.businessId);
  const clinicContacts = business
    ? [
        {
          brand: business.brand,
          label: business.talk_channel_label ?? business.name,
          talkChannelUrl: business.talk_channel_url,
          phone: business.phone,
        },
      ]
    : [];

  return {
    ...recommendation,
    detailDescription:
      recommendedProcedure?.description ??
      `${recommendation.careName}은(는) ${recommendation.reasons.join(", ")}을 근거로 추천되었습니다. 실제 시술 가능 여부와 일정은 매장에 문의해주세요.`,
    relatedRecentCares,
    popularWithSimilarCustomers,
    clinicContacts,
  };
}
