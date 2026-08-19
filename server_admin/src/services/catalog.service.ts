import { supabaseAdmin } from "../config/supabase";
import { Errors } from "../lib/errors";

// 치료-부위 카탈로그 — 관리자 웹에서 치료명을 검색/선택하면 관리 부위 후보를 자동으로 채워주는
// 용도. 2026-08-19 — 원래 "클리닉 공통"으로 설계됐었지만, 실제로는 클리닉마다 취급하는 시술이
// 다르다는 게 확인돼(엑셀 원본 대조) brand 컬럼을 추가하고 조회를 브랜드로 필터링하도록 바꿨다.
// care_type 컬럼은 daily-guide/questions 둘 다 treatment_guides(시술명 직접 매칭)로 넘어가며
// 완전히 제거했다.
export async function listTreatments(brand: string, search?: string) {
  let query = supabaseAdmin
    .from("treatment_catalog")
    .select("*")
    .eq("brand", brand)
    .order("care_name", { ascending: true });
  if (search) query = query.ilike("care_name", `%${search}%`);

  const { data, error } = await query;
  if (error) throw Errors.internal(error.message);
  return data ?? [];
}

export async function createTreatment(
  input: {
    careName: string;
    bodyParts: string[];
    description?: string;
  },
  brand: string,
) {
  const { data, error } = await supabaseAdmin
    .from("treatment_catalog")
    .insert({
      brand,
      care_name: input.careName,
      body_parts: input.bodyParts,
      description: input.description ?? null,
    })
    .select()
    .single();

  if (error) {
    // 23505 = unique_violation (brand+care_name 중복)
    if (error.code === "23505") throw Errors.treatmentNameAlreadyExists();
    throw Errors.internal(error.message);
  }
  return data;
}

export async function updateTreatment(
  id: string,
  input: Partial<{ careName: string; bodyParts: string[]; description: string }>,
) {
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
      ...(input.bodyParts !== undefined && { body_parts: input.bodyParts }),
      ...(input.description !== undefined && { description: input.description }),
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
