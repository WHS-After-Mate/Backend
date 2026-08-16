import { supabaseAdmin } from "../config/supabase";
import { Errors } from "../lib/errors";
import { assertValidCareType } from "./patients.service";

// 치료-부위 카탈로그 — 클리닉(브랜드) 구분 없이 전체 공통으로 관리한다(관리자 CRUD 대상, 시드 아님).
// 관리자 웹에서 치료명을 검색/선택하면 careType/관리 부위 후보를 자동으로 채워주는 용도.
export async function listTreatments(search?: string) {
  let query = supabaseAdmin.from("treatment_catalog").select("*").order("care_name", { ascending: true });
  if (search) query = query.ilike("care_name", `%${search}%`);

  const { data, error } = await query;
  if (error) throw Errors.internal(error.message);
  return data ?? [];
}

export async function createTreatment(input: { careName: string; careType: string; bodyParts: string[] }) {
  await assertValidCareType(input.careType);

  const { data, error } = await supabaseAdmin
    .from("treatment_catalog")
    .insert({ care_name: input.careName, care_type: input.careType, body_parts: input.bodyParts })
    .select()
    .single();

  if (error) {
    // 23505 = unique_violation (care_name 중복)
    if (error.code === "23505") throw Errors.treatmentNameAlreadyExists();
    throw Errors.internal(error.message);
  }
  return data;
}

export async function updateTreatment(
  id: string,
  input: Partial<{ careName: string; careType: string; bodyParts: string[] }>,
) {
  if (input.careType !== undefined) await assertValidCareType(input.careType);

  const { data: existing, error: existingError } = await supabaseAdmin
    .from("treatment_catalog")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  if (existingError) throw Errors.internal(existingError.message);
  if (!existing) throw Errors.treatmentNotFound();

  const { data, error } = await supabaseAdmin
    .from("treatment_catalog")
    .update({
      ...(input.careName !== undefined && { care_name: input.careName }),
      ...(input.careType !== undefined && { care_type: input.careType }),
      ...(input.bodyParts !== undefined && { body_parts: input.bodyParts }),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    if (error.code === "23505") throw Errors.treatmentNameAlreadyExists();
    throw Errors.internal(error.message);
  }
  return data;
}

export async function deleteTreatment(id: string) {
  const { data, error } = await supabaseAdmin.from("treatment_catalog").delete().eq("id", id).select("id").maybeSingle();
  if (error) throw Errors.internal(error.message);
  if (!data) throw Errors.treatmentNotFound();
}
