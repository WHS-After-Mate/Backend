import { supabaseAdmin } from "../config/supabase";

export interface MedicalProfile {
  allergies: string[];
  chronicConditions: string[];
  doctorGeneralComment: string | null;
}

const EMPTY_PROFILE: MedicalProfile = { allergies: [], chronicConditions: [], doctorGeneralComment: null };

// 민감정보(알러지/기저질환) 조회 + 접근 감사 로그. LLM 컨텍스트 조립 시 항상 이 함수를 통해서만 접근한다.
export async function getMedicalProfileForLlmContext(
  userId: string,
  requestContext: string,
): Promise<MedicalProfile> {
  const { data } = await supabaseAdmin
    .from("medical_profiles")
    .select("allergies, chronic_conditions, doctor_general_comment")
    .eq("user_id", userId)
    .maybeSingle();

  await supabaseAdmin.from("medical_data_access_log").insert({
    patient_user_id: userId,
    accessed_by: "llm_system",
    accessed_fields: ["allergies", "chronic_conditions", "doctor_general_comment"],
    request_context: requestContext,
  });

  if (!data) return EMPTY_PROFILE;

  return {
    allergies: (data.allergies as string[]) ?? [],
    chronicConditions: (data.chronic_conditions as string[]) ?? [],
    doctorGeneralComment: data.doctor_general_comment as string | null,
  };
}
