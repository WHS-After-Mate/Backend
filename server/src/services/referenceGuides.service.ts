import { supabaseAdmin } from "../config/supabase";

export interface ReferenceGuideRow {
  id: string;
  care_type: string;
  elapsed_range_start: number;
  elapsed_range_end: number;
  elapsed_range_label: string;
  must_avoid: string[];
  basic_care: string[];
  next_check_offset_days: number | null;
}

// daily-guide/questions 공통: elapsed_range는 LLM이 아니라 이 규칙(구간 lookup)이 먼저 결정한다.
export async function findReferenceGuide(
  careType: string | null,
  daysElapsed: number,
): Promise<ReferenceGuideRow | null> {
  if (!careType) return null;

  const { data, error } = await supabaseAdmin
    .from("reference_guides")
    .select(
      "id, care_type, elapsed_range_start, elapsed_range_end, elapsed_range_label, must_avoid, basic_care, next_check_offset_days",
    )
    .eq("care_type", careType)
    .lte("elapsed_range_start", daysElapsed)
    .gte("elapsed_range_end", daysElapsed)
    .maybeSingle();

  if (error) return null;
  return data as ReferenceGuideRow | null;
}
