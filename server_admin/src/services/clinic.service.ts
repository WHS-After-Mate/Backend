import { supabaseAdmin } from "../config/supabase";
import { Errors } from "../lib/errors";

// 클리닉(브랜드) 공개 정보(카카오톡 상담 링크/전화번호) + 담당 의료진 목록 — 로그인한 관리자의
// brand로만 조회한다(admin_accounts처럼 다른 클리닉 정보는 아예 안 보임). 관리 등록 화면에서
// 담당의(practitioner) select를 채우고, 클리닉 연락처를 보여주는 용도.
// 연락처는 별도 clinics 테이블이 아니라 public.businesses(server/db/migrations/015_add_care_catalog.sql,
// 관리 추천 카탈로그용으로 신설된 테이블)를 그대로 재사용한다 — 같은 목적의 데이터를 중복 관리하지 않기 위함.
export async function getClinicInfo(brand: string) {
  const [{ data: business, error: businessError }, { data: doctors, error: doctorsError }] = await Promise.all([
    supabaseAdmin.from("businesses").select("brand, talk_channel_url, phone").eq("brand", brand).maybeSingle(),
    supabaseAdmin.from("clinic_doctors").select("id, name").eq("brand", brand).order("name", { ascending: true }),
  ]);

  if (businessError) throw Errors.internal(businessError.message);
  if (doctorsError) throw Errors.internal(doctorsError.message);

  return {
    brand,
    kakaoUrl: business?.talk_channel_url ?? null,
    phone: business?.phone ?? null,
    doctors: doctors ?? [],
  };
}
