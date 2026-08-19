import { supabaseAdmin } from "../config/supabase";

export interface TreatmentGuideRow {
  id: string;
  care_name: string;
  day: number;
  key_care: string;
  aftercare: string[];
  precautions: string[];
}

// care_type 그룹핑 대신 시술명(care_name) 직접 매칭 — day는 1/3/5/7/14만 존재(그 외 날짜는
// 이 테이블에 없고 aftercare.service.ts가 LLM으로 폴백한다).
export async function findTreatmentGuide(careName: string, day: number): Promise<TreatmentGuideRow | null> {
  const { data, error } = await supabaseAdmin
    .from("treatment_guides")
    .select("id, care_name, day, key_care, aftercare, precautions")
    .eq("care_name", careName)
    .eq("day", day)
    .maybeSingle();

  if (error) return null;
  return data as TreatmentGuideRow | null;
}
