import { supabaseAdmin } from "../config/supabase";
import { Errors } from "../lib/errors";

// 실제 사업장/시술 카탈로그(businesses/procedures, 2026-08-17 신규) — docs/care_procedure_template.xlsx
// 46개 시술을 seedCareCatalog.ts로 반영한 결과를 그대로 조회한다. 관리 추천(recommendations.service.ts)이
// 이 카탈로그 전체를 후보 풀로 쓴다.

export interface ProcedureRow {
  id: string;
  business_id: string;
  name: string;
  category_tags: string[];
  description: string | null;
}

export interface BusinessRow {
  id: string;
  name: string;
  brand: string;
  talk_channel_label: string | null;
  talk_channel_url: string | null;
  phone: string | null;
}

export async function listAllProcedures(): Promise<ProcedureRow[]> {
  const { data, error } = await supabaseAdmin
    .from("procedures")
    .select("id, business_id, name, category_tags, description");
  if (error) throw Errors.internal(error.message);
  return data ?? [];
}

export async function listAllBusinesses(): Promise<BusinessRow[]> {
  const { data, error } = await supabaseAdmin
    .from("businesses")
    .select("id, name, brand, talk_channel_label, talk_channel_url, phone");
  if (error) throw Errors.internal(error.message);
  return data ?? [];
}

export async function getBusinessById(businessId: string): Promise<BusinessRow | null> {
  const { data, error } = await supabaseAdmin
    .from("businesses")
    .select("id, name, brand, talk_channel_label, talk_channel_url, phone")
    .eq("id", businessId)
    .maybeSingle();
  if (error) throw Errors.internal(error.message);
  return data;
}
