import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 .env에 설정되어 있어야 합니다.");
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const DEMO_EMAIL = "demo@whsaftermate.app";
const DEMO_PASSWORD = "Passw0rd!2024";

const REFERENCE_GUIDES: {
  care_type: string;
  elapsed_range_start: number;
  elapsed_range_end: number;
  elapsed_range_label: string;
  must_avoid: string[];
  basic_care: string[];
  next_check_offset_days: number | null;
}[] = [
  {
    care_type: "peeling",
    elapsed_range_start: 0,
    elapsed_range_end: 2,
    elapsed_range_label: "0-2",
    must_avoid: ["직사광선 장시간 노출", "각질 제거 제품 사용", "사우나·찜질방"],
    basic_care: ["미온수 세안", "저자극 보습제 사용", "자외선 차단제 필수"],
    next_check_offset_days: 3,
  },
  {
    care_type: "peeling",
    elapsed_range_start: 3,
    elapsed_range_end: 7,
    elapsed_range_label: "3-7",
    must_avoid: ["각질 제거 제품 사용", "고강도 유산소 운동", "음주"],
    basic_care: ["미온수 세안", "저자극 보습", "자외선 차단제 재도포"],
    next_check_offset_days: 7,
  },
  {
    care_type: "peeling",
    elapsed_range_start: 8,
    elapsed_range_end: 30,
    elapsed_range_label: "8-30",
    must_avoid: ["강한 마찰 세안"],
    basic_care: ["평소 스킨케어 루틴 복귀 가능", "자외선 차단제 유지"],
    next_check_offset_days: null,
  },
  {
    care_type: "laser_toning",
    elapsed_range_start: 0,
    elapsed_range_end: 2,
    elapsed_range_label: "0-2",
    must_avoid: ["뜨거운 찜질", "메이크업", "사우나"],
    basic_care: ["냉찜질 (필요시)", "미온수 세안", "자외선 차단제 필수"],
    next_check_offset_days: 3,
  },
  {
    care_type: "laser_toning",
    elapsed_range_start: 3,
    elapsed_range_end: 7,
    elapsed_range_label: "3-7",
    must_avoid: ["고강도 운동", "음주"],
    basic_care: ["저자극 보습", "자외선 차단제 재도포"],
    next_check_offset_days: 14,
  },
];

async function main() {
  console.log("[seed] 데모 계정 생성 중...");

  let userId: string;
  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
    email_confirm: true,
  });

  if (createError) {
    if (!createError.message.toLowerCase().includes("already")) throw createError;
    console.log("[seed] 이미 존재하는 데모 계정 재사용");
    const { data: list } = await supabase.auth.admin.listUsers();
    const existing = list?.users.find((u) => u.email === DEMO_EMAIL);
    if (!existing) throw new Error("데모 계정을 찾을 수 없습니다.");
    userId = existing.id;
  } else {
    userId = created.user!.id;
  }

  console.log(`[seed] userId=${userId}`);

  await supabase.from("profiles").upsert({
    user_id: userId,
    name: "홍길동",
    phone: "01012345678",
    phone_verified_at: new Date().toISOString(),
    interest_goals: ["수분 개선", "탄력 관리"],
  });

  await supabase.from("medical_profiles").upsert({
    user_id: userId,
    external_patient_id: "EMR-P-0001",
    allergies: ["레티놀"],
    chronic_conditions: [],
    doctor_general_comment: "민감성 피부, 자극에 주의 필요",
    source_system: "aac_emr",
    synced_at: new Date().toISOString(),
  });

  const today = new Date();
  const daysAgo = (n: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() - n);
    return d.toISOString().slice(0, 10);
  };

  // 재실행 시 중복 누적 방지 (id가 매번 새로 생성되는 테이블이라 upsert 대신 삭제 후 재삽입)
  await supabase.from("care_records").delete().eq("user_id", userId);
  await supabase.from("memberships").delete().eq("user_id", userId);

  const { data: careRecords } = await supabase
    .from("care_records")
    .insert([
      {
        user_id: userId,
        care_name: "브라이트닝 필링",
        care_type: "peeling",
        care_date: daysAgo(5),
        part_of_body: "얼굴",
        brand: "AAC 청담",
        store: "AAC 청담점",
        practitioner: "김OO 원장",
        basic_aftercare_guide: ["당일 세안은 미온수로", "일주일간 자외선 차단제 필수"],
        doctor_comment: "각질 상태 양호, 3일 후 각질 제거 제품 재개 가능",
        source_system: "aac_emr",
        synced_at: new Date().toISOString(),
      },
      {
        user_id: userId,
        care_name: "레이저 토닝",
        care_type: "laser_toning",
        care_date: daysAgo(30),
        part_of_body: "얼굴",
        brand: "AAC 청담",
        store: "AAC 청담점",
        practitioner: "이OO 원장",
        basic_aftercare_guide: ["당일 메이크업 금지", "냉찜질 권장"],
        doctor_comment: null,
        source_system: "aac_emr",
        synced_at: new Date().toISOString(),
      },
    ])
    .select("id, care_name");

  console.log(`[seed] care_records 생성: ${careRecords?.map((c) => c.care_name).join(", ")}`);

  await supabase.from("memberships").insert([
    {
      user_id: userId,
      product_name: "바디 관리 10회권",
      total_count: 10,
      used_count: 7,
      expires_at: daysAgo(-60),
      last_used_at: daysAgo(10),
      available_care_names: ["바디 슬리밍 관리", "림프 순환 관리", "수분 재생 관리"],
    },
    {
      user_id: userId,
      product_name: "페이셜 관리 5회권",
      total_count: 5,
      used_count: 2,
      expires_at: daysAgo(-90),
      last_used_at: daysAgo(5),
      available_care_names: ["수분 재생 관리", "브라이트닝 필링"],
    },
  ]);

  console.log("[seed] reference_guides 등록 중...");
  for (const guide of REFERENCE_GUIDES) {
    await supabase.from("reference_guides").upsert(guide, {
      onConflict: "care_type,elapsed_range_start,elapsed_range_end",
    });
  }

  console.log("[seed] 완료");
  console.log(`[seed] 데모 로그인: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
}

main().catch((err) => {
  console.error("[seed] 실패:", err);
  process.exit(1);
});
