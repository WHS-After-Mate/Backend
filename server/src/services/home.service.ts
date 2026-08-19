import { daysElapsedSince, getLatestCareRecord } from "./careRecords.service";
import { countMemberships, getNearestExpiringMembership } from "./memberships.service";
import { computeNextCareRecommendation } from "./recommendations.service";
import { findTreatmentGuide } from "./treatmentGuides.service";

export async function getHomeSummary(userId: string) {
  const latestCareRow = await getLatestCareRecord(userId);

  const latestCare = latestCareRow
    ? {
        careRecordId: latestCareRow.id,
        careName: latestCareRow.care_name,
        careDate: latestCareRow.care_date,
        daysElapsed: daysElapsedSince(latestCareRow.care_date),
        partOfBody: latestCareRow.part_of_body,
      }
    : null;

  // 2026-08-19 — aftercare_guides(LLM 생성 캐시) 대신 treatment_guides(시술명+오늘 일차 고정
  // 콘텐츠)를 직접 조회한다. daily-guide 쪽에서 이미 LLM 폴백을 없앴으므로 이 카드도 동일한
  // 소스를 봐야 한다 — 매칭 없으면(오늘이 1/3/5/7/14일차가 아니거나 콘텐츠 미작성) null.
  const treatmentGuide =
    latestCareRow && latestCare
      ? await findTreatmentGuide(latestCareRow.care_name, latestCare.daysElapsed)
      : null;
  const aftercareCard = treatmentGuide
    ? {
        guideId: treatmentGuide.id,
        elapsedRange: null,
        cautions: treatmentGuide.precautions,
        nextCheckDate: null,
        generatedAt: new Date().toISOString(),
      }
    : null;

  const [totalMemberships, nearestExpiring, recommendation] = await Promise.all([
    countMemberships(userId),
    getNearestExpiringMembership(userId),
    computeNextCareRecommendation(userId),
  ]);

  return {
    latestCare,
    aftercareCard,
    membershipSummary: {
      totalMemberships,
      nearestExpiry: nearestExpiring
        ? {
            membershipId: nearestExpiring.id,
            expiresAt: nearestExpiring.expires_at,
            remainingCount: nearestExpiring.remaining_count,
          }
        : null,
    },
    recommendation,
  };
}
