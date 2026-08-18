import { supabaseAdmin } from "../config/supabase";
import { daysElapsedSince, getLatestCareRecord } from "./careRecords.service";
import { countMemberships, getNearestExpiringMembership } from "./memberships.service";
import { computeNextCareRecommendation } from "./recommendations.service";

async function getTodaysCachedGuide(careRecordId: string) {
  const todayKst = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" }); // YYYY-MM-DD

  const { data } = await supabaseAdmin
    .from("aftercare_guides")
    .select("id, elapsed_range, precautions, next_check_date, generated_at")
    .eq("care_record_id", careRecordId)
    .eq("generated_date", todayKst)
    .maybeSingle();

  return data as
    | { id: string; elapsed_range: string; precautions: string[]; next_check_date: string | null; generated_at: string }
    | null;
}

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

  const cachedGuide = latestCareRow ? await getTodaysCachedGuide(latestCareRow.id) : null;
  const aftercareCard = cachedGuide
    ? {
        guideId: cachedGuide.id,
        elapsedRange: cachedGuide.elapsed_range,
        cautions: cachedGuide.precautions,
        nextCheckDate: cachedGuide.next_check_date,
        generatedAt: cachedGuide.generated_at,
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
