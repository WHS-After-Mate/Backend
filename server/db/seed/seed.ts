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

const DEMO_PASSWORD = "Passw0rd!2024";

interface PatientSeed {
  email: string;
  name: string;
  phone: string;
  interestGoals: string[];
  medicalProfile: {
    externalPatientId: string;
    allergies: string[];
    chronicConditions: string[];
    doctorGeneralComment: string | null;
  };
  careRecords: {
    careName: string;
    careType: string;
    daysAgo: number;
    partOfBody: string;
    brand: string;
    store: string;
    practitioner: string;
    basicAftercareGuide: string[];
    doctorComment: string | null;
  }[];
  memberships: {
    productName: string;
    totalCount: number;
    usedCount: number;
    expiresInDays: number;
    lastUsedDaysAgo: number;
    availableCareNames: string[];
  }[];
}

// 4명의 가상 고객: 정상 케이스(홍길동) + 이용권 만료 임박(김민지) + 이용권 소진/추천 간격 테스트(이서준) + 신규 고객(박수아)
const PATIENTS: PatientSeed[] = [
  {
    email: "demo@whsaftermate.app",
    name: "홍길동",
    phone: "01012345678",
    interestGoals: ["수분 개선", "탄력 관리"],
    medicalProfile: {
      externalPatientId: "EMR-P-0001",
      allergies: ["레티놀"],
      chronicConditions: [],
      doctorGeneralComment: "민감성 피부, 자극에 주의 필요",
    },
    careRecords: [
      {
        careName: "브라이트닝 필링",
        careType: "peeling",
        daysAgo: 5,
        partOfBody: "얼굴",
        brand: "AAC 청담",
        store: "AAC 청담점",
        practitioner: "김OO 원장",
        basicAftercareGuide: ["당일 세안은 미온수로", "일주일간 자외선 차단제 필수"],
        doctorComment: "각질 상태 양호, 3일 후 각질 제거 제품 재개 가능",
      },
      {
        careName: "레이저 토닝",
        careType: "laser_toning",
        daysAgo: 30,
        partOfBody: "얼굴",
        brand: "AAC 청담",
        store: "AAC 청담점",
        practitioner: "이OO 원장",
        basicAftercareGuide: ["당일 메이크업 금지", "냉찜질 권장"],
        doctorComment: null,
      },
    ],
    memberships: [
      {
        productName: "바디 관리 10회권",
        totalCount: 10,
        usedCount: 7,
        expiresInDays: 60,
        lastUsedDaysAgo: 10,
        availableCareNames: ["바디 슬리밍 관리", "림프 순환 관리", "수분 재생 관리"],
      },
      {
        productName: "페이셜 관리 5회권",
        totalCount: 5,
        usedCount: 2,
        expiresInDays: 90,
        lastUsedDaysAgo: 5,
        availableCareNames: ["수분 재생 관리", "브라이트닝 필링"],
      },
    ],
  },
  {
    email: "demo2@whsaftermate.app",
    name: "김민지",
    phone: "01023456789",
    interestGoals: ["미백", "모공 관리"],
    medicalProfile: {
      externalPatientId: "EMR-P-0002",
      allergies: ["벤조일퍼옥사이드"],
      chronicConditions: ["아토피"],
      doctorGeneralComment: "아토피 병력 있어 자극 성분 주의",
    },
    careRecords: [
      {
        careName: "레이저 토닝",
        careType: "laser_toning",
        daysAgo: 2,
        partOfBody: "얼굴",
        brand: "AAC 강남",
        store: "AAC 강남점",
        practitioner: "박OO 원장",
        basicAftercareGuide: ["당일 메이크업 금지", "냉찜질 권장"],
        doctorComment: "초기 진정 관리 중, 자극 성분 접촉 주의",
      },
    ],
    memberships: [
      {
        // 만료 임박 케이스 — GET /home/summary의 membershipSummary.nearestExpiry 테스트용
        productName: "페이셜 리프팅 3회권",
        totalCount: 3,
        usedCount: 1,
        expiresInDays: 14,
        lastUsedDaysAgo: 20,
        availableCareNames: ["페이셜 리프팅", "수분 재생 관리"],
      },
    ],
  },
  {
    email: "demo3@whsaftermate.app",
    name: "이서준",
    phone: "01034567890",
    interestGoals: [],
    medicalProfile: {
      externalPatientId: "EMR-P-0003",
      allergies: [],
      chronicConditions: [],
      doctorGeneralComment: null,
    },
    careRecords: [
      {
        // MIN_INTERVAL_DAYS(21일) 이상 경과 — 다음 관리 추천 "N주 경과" 문구 테스트용
        careName: "브라이트닝 필링",
        careType: "peeling",
        daysAgo: 25,
        partOfBody: "얼굴",
        brand: "AAC 청담",
        store: "AAC 청담점",
        practitioner: "김OO 원장",
        basicAftercareGuide: ["당일 세안은 미온수로", "일주일간 자외선 차단제 필수"],
        doctorComment: null,
      },
    ],
    memberships: [
      {
        // 전량 소진(remainingCount 0) — 추천 후보에서 제외되는지 테스트용
        productName: "바디 슬리밍 관리 5회권",
        totalCount: 5,
        usedCount: 5,
        expiresInDays: 45,
        lastUsedDaysAgo: 3,
        availableCareNames: ["바디 슬리밍 관리"],
      },
    ],
  },
  {
    email: "demo4@whsaftermate.app",
    name: "박수아",
    phone: "01045678901",
    interestGoals: ["수분 개선"],
    medicalProfile: {
      externalPatientId: "EMR-P-0004",
      allergies: [],
      chronicConditions: [],
      doctorGeneralComment: null,
    },
    // 관리 이력/이용권 없는 완전 신규 고객 — latestCare: null, 204 NO_RECOMMENDATION_AVAILABLE 테스트용
    careRecords: [],
    memberships: [],
  },
];

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

const today = new Date();
const daysAgo = (n: number) => {
  const d = new Date(today);
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};

async function seedPatient(patient: PatientSeed) {
  console.log(`[seed] ${patient.name}(${patient.email}) 계정 생성 중...`);

  let userId: string;
  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email: patient.email,
    password: DEMO_PASSWORD,
    email_confirm: true,
  });

  if (createError) {
    if (!createError.message.toLowerCase().includes("already")) throw createError;
    console.log(`[seed]   이미 존재하는 계정 재사용`);
    const { data: list } = await supabase.auth.admin.listUsers();
    const existing = list?.users.find((u) => u.email === patient.email);
    if (!existing) throw new Error(`${patient.email} 계정을 찾을 수 없습니다.`);
    userId = existing.id;
  } else {
    userId = created.user!.id;
  }

  console.log(`[seed]   userId=${userId}`);

  await supabase.from("profiles").upsert({
    user_id: userId,
    name: patient.name,
    phone: patient.phone,
    phone_verified_at: new Date().toISOString(),
    interest_goals: patient.interestGoals,
  });

  await supabase.from("medical_profiles").upsert({
    user_id: userId,
    external_patient_id: patient.medicalProfile.externalPatientId,
    allergies: patient.medicalProfile.allergies,
    chronic_conditions: patient.medicalProfile.chronicConditions,
    doctor_general_comment: patient.medicalProfile.doctorGeneralComment,
    source_system: "aac_emr",
    synced_at: new Date().toISOString(),
  });

  // 재실행 시 중복 누적 방지 (id가 매번 새로 생성되는 테이블이라 upsert 대신 삭제 후 재삽입)
  await supabase.from("care_records").delete().eq("user_id", userId);
  await supabase.from("memberships").delete().eq("user_id", userId);

  if (patient.careRecords.length > 0) {
    const { data: careRecords } = await supabase
      .from("care_records")
      .insert(
        patient.careRecords.map((record) => ({
          user_id: userId,
          care_name: record.careName,
          care_type: record.careType,
          care_date: daysAgo(record.daysAgo),
          part_of_body: record.partOfBody,
          brand: record.brand,
          store: record.store,
          practitioner: record.practitioner,
          basic_aftercare_guide: record.basicAftercareGuide,
          doctor_comment: record.doctorComment,
          source_system: "aac_emr",
          synced_at: new Date().toISOString(),
        })),
      )
      .select("id, care_name");

    console.log(`[seed]   care_records 생성: ${careRecords?.map((c) => c.care_name).join(", ")}`);
  } else {
    console.log("[seed]   care_records 없음 (신규 고객 케이스)");
  }

  if (patient.memberships.length > 0) {
    await supabase.from("memberships").insert(
      patient.memberships.map((m) => ({
        user_id: userId,
        product_name: m.productName,
        total_count: m.totalCount,
        used_count: m.usedCount,
        expires_at: daysAgo(-m.expiresInDays),
        last_used_at: daysAgo(m.lastUsedDaysAgo),
        available_care_names: m.availableCareNames,
      })),
    );
    console.log(`[seed]   memberships 생성: ${patient.memberships.length}건`);
  } else {
    console.log("[seed]   memberships 없음");
  }
}

async function main() {
  for (const patient of PATIENTS) {
    await seedPatient(patient);
  }

  console.log("[seed] reference_guides 등록 중...");
  for (const guide of REFERENCE_GUIDES) {
    await supabase.from("reference_guides").upsert(guide, {
      onConflict: "care_type,elapsed_range_start,elapsed_range_end",
    });
  }

  console.log("[seed] 완료");
  console.log(`[seed] 데모 계정 ${PATIENTS.length}개 (공통 비밀번호: ${DEMO_PASSWORD})`);
  for (const patient of PATIENTS) {
    console.log(`[seed]   - ${patient.name}: ${patient.email}`);
  }
}

main().catch((err) => {
  console.error("[seed] 실패:", err);
  process.exit(1);
});
