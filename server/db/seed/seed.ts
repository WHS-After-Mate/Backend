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
  birthDate: string;
  interestGoals: string[];
  medicalProfile: {
    externalPatientId: string;
    allergies: string[];
    chronicConditions: string[];
    doctorGeneralComment: string | null;
  };
  careRecords: {
    careName: string;
    daysAgo: number;
    partOfBody: string[];
    brand: string;
    practitioner: string;
    basicAftercareGuide: string[];
    doctorComment: string | null;
    // 관리 상세 화면의 "관리 회차 N/M회차" + 연결 이용권 데모용 (v0.5) — 아래 memberships의 productName과 매칭
    linkedMembershipProductName?: string;
    sessionNumber?: number;
    totalSessions?: number;
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
    birthDate: "1990-03-15",
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
        daysAgo: 5,
        partOfBody: ["얼굴 전체"],
        brand: "AMRED CLINIC",
        practitioner: "김OO 원장",
        basicAftercareGuide: ["당일 세안은 미온수로", "일주일간 자외선 차단제 필수"],
        doctorComment: "각질 상태 양호, 3일 후 각질 제거 제품 재개 가능",
        linkedMembershipProductName: "페이셜 관리 5회권",
        sessionNumber: 2,
        totalSessions: 5,
      },
      {
        careName: "레이저 토닝",
        daysAgo: 30,
        partOfBody: ["얼굴 전체"],
        brand: "AMRED CLINIC",
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
    birthDate: "1995-07-22",
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
        daysAgo: 2,
        partOfBody: ["얼굴 전체"],
        brand: "DERNA CLINIC",
        practitioner: "박OO 원장",
        basicAftercareGuide: ["당일 메이크업 금지", "냉찜질 권장"],
        doctorComment: "초기 진정 관리 중, 자극 성분 접촉 주의",
        linkedMembershipProductName: "페이셜 리프팅 3회권",
        sessionNumber: 1,
        totalSessions: 3,
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
        availableCareNames: ["페이셜 리프팅", "수분 재생 관리", "레이저 토닝"],
      },
    ],
  },
  {
    email: "demo3@whsaftermate.app",
    name: "이서준",
    phone: "01034567890",
    birthDate: "1988-11-02",
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
        daysAgo: 25,
        partOfBody: ["얼굴 전체"],
        brand: "AMRED CLINIC",
        practitioner: "김OO 원장",
        basicAftercareGuide: ["당일 세안은 미온수로", "일주일간 자외선 차단제 필수"],
        doctorComment: null,
        linkedMembershipProductName: "바디 슬리밍 관리 5회권",
        sessionNumber: 5,
        totalSessions: 5,
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
        availableCareNames: ["바디 슬리밍 관리", "브라이트닝 필링"],
      },
    ],
  },
  {
    email: "demo4@whsaftermate.app",
    name: "박수아",
    phone: "01045678901",
    birthDate: "2000-01-04",
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
    birth_date: patient.birthDate,
    phone: patient.phone,
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

  let careRecords: { id: string; care_name: string }[] = [];
  if (patient.careRecords.length > 0) {
    const { data } = await supabase
      .from("care_records")
      .insert(
        patient.careRecords.map((record) => ({
          user_id: userId,
          care_name: record.careName,
          care_date: daysAgo(record.daysAgo),
          part_of_body: record.partOfBody,
          brand: record.brand,
          practitioner: record.practitioner,
          basic_aftercare_guide: record.basicAftercareGuide,
          doctor_comment: record.doctorComment,
          source_system: "aac_emr",
          synced_at: new Date().toISOString(),
        })),
      )
      .select("id, care_name");

    careRecords = data ?? [];
    console.log(`[seed]   care_records 생성: ${careRecords.map((c) => c.care_name).join(", ")}`);
  } else {
    console.log("[seed]   care_records 없음 (신규 고객 케이스)");
  }

  if (patient.memberships.length > 0) {
    const { data: memberships } = await supabase
      .from("memberships")
      .insert(
        patient.memberships.map((m) => ({
          user_id: userId,
          product_name: m.productName,
          total_count: m.totalCount,
          used_count: m.usedCount,
          expires_at: daysAgo(-m.expiresInDays),
          last_used_at: daysAgo(m.lastUsedDaysAgo),
          available_care_names: m.availableCareNames,
        })),
      )
      .select("id, product_name");
    console.log(`[seed]   memberships 생성: ${patient.memberships.length}건`);

    // 회차별 사용 이력 시드 — My Care·이용권 화면의 usageHistory 데모용 (v0.5)
    for (const membership of memberships ?? []) {
      const source = patient.memberships.find((m) => m.productName === membership.product_name);
      if (!source || source.usedCount <= 0) continue;

      const usageRows = Array.from({ length: source.usedCount }, (_, i) => {
        const sessionNumber = i + 1; // 오래된 회차일수록 번호가 작음
        const usedDaysAgo = source.lastUsedDaysAgo + (source.usedCount - sessionNumber) * 30;
        return {
          membership_id: membership.id,
          session_number: sessionNumber,
          used_at: daysAgo(usedDaysAgo),
        };
      });
      await supabase.from("membership_usages").insert(usageRows);
    }

    // 관리 상세 화면의 "관리 회차 N/M회차" + 연결 이용권 데모 연결 (v0.5)
    for (const record of patient.careRecords) {
      if (!record.linkedMembershipProductName) continue;
      const membership = memberships?.find((m) => m.product_name === record.linkedMembershipProductName);
      const careRecord = careRecords.find((c) => c.care_name === record.careName);
      if (!membership || !careRecord) continue;

      await supabase
        .from("care_records")
        .update({
          membership_id: membership.id,
          session_number: record.sessionNumber,
          total_sessions: record.totalSessions,
        })
        .eq("id", careRecord.id);
    }
  } else {
    console.log("[seed]   memberships 없음");
  }
}

async function main() {
  for (const patient of PATIENTS) {
    await seedPatient(patient);
  }

  console.log("[seed] 완료");
  console.log(`[seed] 데모 계정 ${PATIENTS.length}개 (공통 비밀번호: ${DEMO_PASSWORD})`);
  for (const patient of PATIENTS) {
    console.log(`[seed]   - ${patient.name}: ${patient.email}`);
  }
  console.log(
    "[seed] 사후관리 콘텐츠(daily-guide 근거)는 이 스크립트가 아니라 `npm run seed:treatment-guides`" +
      "(db/seed/seedTreatmentGuides.ts, treatment_guides 테이블)로 별도 시딩한다.",
  );
}

main().catch((err) => {
  console.error("[seed] 실패:", err);
  process.exit(1);
});
