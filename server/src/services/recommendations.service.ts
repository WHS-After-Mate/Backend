import crypto from "node:crypto";
import { supabaseAdmin } from "../config/supabase";
import { daysElapsedSince, getLatestCareRecord } from "./careRecords.service";
import { listMemberships } from "./memberships.service";

const DISCLAIMER = "의료적 진단이 아니며 최종 관리는 전문가 상담 후 결정하세요.";
const MIN_INTERVAL_DAYS = 21;

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

export async function computeNextCareRecommendation(userId: string) {
  const latestCare = await getLatestCareRecord(userId);
  if (!latestCare) return null;

  const { items: memberships } = await listMemberships(userId);
  const goals = await getInterestGoals(userId);

  const daysElapsed = daysElapsedSince(latestCare.care_date);
  const basis: string[] = ["latestCare"];
  const reasons: string[] = [];

  if (daysElapsed >= MIN_INTERVAL_DAYS) {
    reasons.push(`최근 관리(${latestCare.care_name}) 후 ${Math.floor(daysElapsed / 7)}주 경과`);
  }

  const candidateNames = memberships
    .filter((m) => m.remainingCount > 0)
    .flatMap((m) => m.availableCareNames)
    .filter((name) => name !== latestCare.care_name);

  let careName = candidateNames[0];

  if (goals.length > 0) {
    const goalMatch = candidateNames.find((name) => goals.some((goal) => name.includes(goal.slice(0, 2))));
    if (goalMatch) {
      careName = goalMatch;
      basis.push("goal");
      reasons.push(`관심 목표: ${goals.join(", ")}`);
    }
  }

  if (!careName) return null;

  if (memberships.some((m) => m.availableCareNames.includes(careName!) && m.remainingCount > 0)) {
    basis.push("membership");
    reasons.push("보유 이용권 내 이용 가능");
  }

  if (reasons.length === 0) {
    reasons.push(`최근 관리(${latestCare.care_name}) 이후 다음 관리를 준비할 시기입니다.`);
  }

  return {
    recommendationId: recommendationIdFor(userId),
    careName,
    reasons,
    basis,
    disclaimer: DISCLAIMER,
  };
}

export async function getNextCareRecommendationDetail(userId: string, recommendationId: string) {
  const recommendation = await computeNextCareRecommendation(userId);
  if (!recommendation || recommendation.recommendationId !== recommendationId) return null;

  return {
    ...recommendation,
    detailDescription: `${recommendation.careName}은(는) ${recommendation.reasons.join(", ")}을 근거로 추천되었습니다. 실제 시술 가능 여부와 일정은 매장에 문의해주세요.`,
  };
}
