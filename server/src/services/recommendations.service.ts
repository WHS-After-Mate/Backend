import crypto from "node:crypto";
import { supabaseAdmin } from "../config/supabase";
import { sanitizeLlmText, sanitizeLlmTextArray } from "../lib/sanitizeLlmText";
import { listAllBusinesses, listAllProcedures, type ProcedureRow } from "./careCatalog.service";
import { daysElapsedSince, getLatestCareRecord, listRecentCareRecords } from "./careRecords.service";
import { callStructuredLlm } from "./llm/client";
import {
  RECOMMENDATION_INPUT_SCHEMA,
  RECOMMENDATION_SYSTEM_PROMPT,
  RECOMMENDATION_TOOL_NAME,
  buildRecommendationUserMessage,
  type RecommendationContext,
  type RecommendationLlmOutput,
} from "./llm/recommendation.prompt";

const DISCLAIMER = "의료적 진단이 아니며 최종 관리는 전문가 상담 후 결정하세요.";
const RECENT_CARES_FOR_MATCH = 10; // 최근 시술 이력에서 categoryTags를 뽑아 연관성 가중치를 매길 때 볼 개수
const RELATED_CARES_LIMIT = 3;

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
      // goalOverlap 개수는 시술 대부분이 태그 1~2개뿐이라 거의 항상 동점이 난다 — 동점일 때 전체
      // recentRelevance로 비교하면 최근 이력이 특정 카테고리에 몰린 고객은 관심목표를 뭘로 바꿔도
      // 그 카테고리를 겸하는 "제너럴리스트" 시술이 계속 1등을 차지하는 문제가 생긴다(오세훈 계정에서
      // 재현: 관심목표를 바꿔도 추천이 항상 동일). 동점 비교는 관심목표와 겹치는 태그만으로 한정한다.
      const goalRelevance = goalOverlap.reduce((sum, tag) => sum + (recentTagCounts.get(tag) ?? 0), 0);
      return { procedure, goalOverlap, recentRelevance, goalRelevance };
    })
    .filter((s) => s.goalOverlap.length > 0 || s.recentRelevance > 0)
    .sort(
      (a, b) =>
        b.goalOverlap.length - a.goalOverlap.length ||
        b.goalRelevance - a.goalRelevance ||
        a.procedure.category_tags.length - b.procedure.category_tags.length ||
        a.procedure.name.localeCompare(b.procedure.name),
    );
}

// 2026-08-18 — dd.txt 요청: 추천 사유/설명이 시술 종류와 무관하게 획일적인 문구 조합이었던 것을
// LLM 기반으로 교체(시술마다 다른 문구가 생성됨). 실패/키 미설정 시 기존 템플릿 문구로 폴백한다.
const REASON_MAX_LEN = 30;
const DETAIL_MAX_LEN = 40;

// 모델이 스키마 힌트(정확히 3개, 30자 이내)를 못 지켰을 때를 대비한 코드 레벨 안전장치 —
// 개수는 재시도로 맞추게 유도(아래 반복문의 continue), 길이는 넘치면 그냥 잘라서 앱 화면 깨짐을 막는다.
function truncate(text: string, maxLen: number): string {
  return text.length > maxLen ? `${text.slice(0, maxLen - 1)}…` : text;
}

async function generateRecommendationCopy(ctx: RecommendationContext): Promise<RecommendationLlmOutput | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const output = await callStructuredLlm<RecommendationLlmOutput>({
        system: RECOMMENDATION_SYSTEM_PROMPT,
        userMessage: buildRecommendationUserMessage(ctx),
        toolName: RECOMMENDATION_TOOL_NAME,
        toolDescription: "추천 사유와 상세 설명을 구조화된 형식으로 제출합니다.",
        inputSchema: RECOMMENDATION_INPUT_SCHEMA,
      });
      if (!output.reasons || output.reasons.length !== 3 || !output.detailDescription) continue;
      return {
        reasons: sanitizeLlmTextArray(output.reasons).map((r) => truncate(r, REASON_MAX_LEN)),
        detailDescription: truncate(sanitizeLlmText(output.detailDescription), DETAIL_MAX_LEN),
      };
    } catch {
      continue;
    }
  }
  return null;
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
  if (top.goalOverlap.length > 0) basis.push("goal");
  if (top.recentRelevance > 0) basis.push("recentCare");

  // LLM 완전 실패(OpenAI 키 없음/호출 계속 실패) 시에만 쓰는 폴백 — 이때도 reasons 3개 고정 규칙은
  // 지켜야 앱 카드 레이아웃이 안 깨지므로, 후보가 부족하면 일반 문구로 채우고 전부 30자로 자른다.
  const fallbackReasons: string[] = [];
  if (top.goalOverlap.length > 0) {
    fallbackReasons.push(truncate(`관심 목표(${top.goalOverlap[0]})와 연결돼요.`, REASON_MAX_LEN));
  }
  if (top.recentRelevance > 0) {
    fallbackReasons.push(truncate(`최근 관리(${latestCare.care_name})와 연관돼요.`, REASON_MAX_LEN));
  }
  fallbackReasons.push(truncate(`${top.procedure.name}, 다음 관리로 추천드려요.`, REASON_MAX_LEN));
  while (fallbackReasons.length < 3) {
    fallbackReasons.push("전문가 상담 후 진행을 추천드려요.");
  }
  fallbackReasons.length = 3;

  const llmCopy = await generateRecommendationCopy({
    careName: top.procedure.name,
    procedureDescription: top.procedure.description,
    categoryTags: top.procedure.category_tags,
    goalOverlap: top.goalOverlap,
    interestGoals: goals,
    latestCareName: latestCare.care_name,
    recentCareNames: recentCares.map((r) => r.care_name),
  });

  return {
    recommendationId: recommendationIdFor(userId),
    careName: top.procedure.name,
    businessId: top.procedure.business_id,
    reasons: llmCopy?.reasons ?? fallbackReasons,
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
    brand: row.brand,
  }));

  const recommendedProcedure = allProcedures.find((p) => p.name === recommendation.careName);
  // 엑셀(care_procedure_template.xlsx)에서 시술마다 O로 표시된 관심목표 칼럼 — procedures.category_tags 그대로 노출
  const categoryTags = recommendedProcedure?.category_tags ?? [];

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

  // 카탈로그 원문 설명(procedures.description)은 보통 여러 문장이라 그대로 쓰면 앱 화면에서 너무 길다
  // (dd.txt 피드백) — 원문은 LLM에 사실 근거로만 넘기고, 한 줄 요약은 항상 새로 생성한다.
  const [goals, latestCare] = await Promise.all([getInterestGoals(userId), getLatestCareRecord(userId)]);
  const llmCopy = await generateRecommendationCopy({
    careName: recommendation.careName,
    procedureDescription: recommendedProcedure?.description ?? null,
    categoryTags: recommendedProcedure?.category_tags ?? [],
    goalOverlap: recommendation.basis.includes("goal") ? goals : [],
    interestGoals: goals,
    latestCareName: latestCare?.care_name ?? recommendation.careName,
    recentCareNames: recentCares.map((r) => r.care_name),
  });
  const detailDescription =
    llmCopy?.detailDescription ??
    truncate(recommendedProcedure?.description ?? `${recommendation.careName}, 다음 관리로 추천드려요.`, DETAIL_MAX_LEN);

  return {
    ...recommendation,
    detailDescription,
    relatedRecentCares,
    categoryTags,
    clinicContacts,
  };
}
