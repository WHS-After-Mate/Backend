import crypto from "node:crypto";
import { supabaseAdmin } from "../config/supabase";
import { daysElapsedSince, getLatestCareRecord, listRecentCareRecords } from "./careRecords.service";
import { listMemberships } from "./memberships.service";

const DISCLAIMER = "의료적 진단이 아니며 최종 관리는 전문가 상담 후 결정하세요.";
const MIN_INTERVAL_DAYS = 21;
const RELATED_CARES_LIMIT = 3;

// 관리명/관심 목표 텍스트를 공통 태그로 묶는 키워드 그룹 (v0.5) — 실제 유사도 계산이 아니라
// 키워드 매칭 기반 근사치 (MVP 범위). "비슷한 고객이 자주 찾는 관리" 태그와 interestGoals
// 매칭 양쪽에서 같은 어휘를 재사용해, "미백" 같은 관심 목표가 "브라이트닝 필링"처럼 다른
// 표현을 쓰는 관리명과도 매칭되도록 함 (단순 앞글자 substring 비교보다 정확)
const KEYWORD_GROUPS: { tags: string[]; keywords: string[] }[] = [
  { tags: ["리프트 관리", "탄력 관리"], keywords: ["리프트", "리프팅", "탄력"] },
  { tags: ["색소 관리", "브라이트닝 케어"], keywords: ["미백", "브라이트닝", "색소", "톤업"] },
  { tags: ["수분 재생 관리", "보습 케어"], keywords: ["수분", "보습", "재생"] },
  { tags: ["모공 관리", "피지 케어"], keywords: ["모공", "피지", "트러블"] },
  { tags: ["바디라인 관리", "슬리밍 케어"], keywords: ["바디", "슬리밍", "체형"] },
];
const DEFAULT_POPULAR_TAGS = ["회복탄력 관리", "색소 관리", "수분 재생 관리"];

function tagsFor(text: string): string[] {
  const tags = KEYWORD_GROUPS.filter((group) => group.keywords.some((keyword) => text.includes(keyword))).flatMap(
    (group) => group.tags,
  );
  return [...new Set(tags)];
}

function popularTagsFor(careName: string): string[] {
  const tags = tagsFor(careName);
  return tags.length > 0 ? tags : DEFAULT_POPULAR_TAGS;
}

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
    const goalTags = new Set(goals.flatMap((goal) => tagsFor(goal)));
    const goalMatch = candidateNames.find((name) => tagsFor(name).some((tag) => goalTags.has(tag)));
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

  // "최근 관리와 함께 확인해보세요" / "담당" chips (v0.5) — 신규 테이블 없이 care_records에서 즉석 계산
  const recentCares = await listRecentCareRecords(userId, RELATED_CARES_LIMIT);
  const relatedRecentCares = recentCares.map((row) => ({
    careRecordId: row.id,
    careName: row.care_name,
    daysElapsed: daysElapsedSince(row.care_date),
  }));
  const clinicContacts = [...new Set(recentCares.map((row) => row.brand).filter((b): b is string => !!b))].map(
    (brand) => ({ brand, label: `${brand} 클리닉` }),
  );

  return {
    ...recommendation,
    detailDescription: `${recommendation.careName}은(는) ${recommendation.reasons.join(", ")}을 근거로 추천되었습니다. 실제 시술 가능 여부와 일정은 매장에 문의해주세요.`,
    relatedRecentCares,
    popularWithSimilarCustomers: popularTagsFor(recommendation.careName),
    clinicContacts,
  };
}
