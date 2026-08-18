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
    careType: string;
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
        careType: "peeling",
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
        careType: "laser_toning",
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
        careType: "laser_toning",
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
        careType: "peeling",
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
  // 아래 5종은 엠레드/더나 실제 시술 카탈로그 등록(treatment_catalog, 2026-08-17)을 위한 경과일별
  // 세분화 버전이며, 2026-08-19 dd.txt 피드백("내용이 너무 뻔하다 — 전문적인 사후관리 필요")을
  // 반영해 시술별 회복 단계에 맞는 내용으로 다시 작성했다. assertValidCareType이 reference_guides에
  // 해당 care_type이 "존재하는지"만 확인하므로 카탈로그 등록엔 영향 없다 — 실제 의료진 검수 전까지는
  // 여전히 잠정 문구다(일반적으로 통용되는 시술 후 관리 지식을 바탕으로 작성, 의학적 처방 아님).
  {
    care_type: "energy_lifting",
    elapsed_range_start: 0,
    elapsed_range_end: 1,
    elapsed_range_label: "0-1",
    must_avoid: ["당일 사우나·찜질방·반신욕", "당일 격한 유산소 운동", "시술 부위 강하게 문지르거나 마사지", "장시간 직사광선 노출"],
    basic_care: [
      "미열감·붉은기 있으면 냉찜질 10~15분씩",
      "미온수로 순하게 세안",
      "자외선 차단제 2~3시간마다 재도포",
      "충분한 수분 섭취",
    ],
    next_check_offset_days: 2,
  },
  {
    care_type: "energy_lifting",
    elapsed_range_start: 2,
    elapsed_range_end: 3,
    elapsed_range_label: "2-3",
    must_avoid: ["시술 부위 강한 압박·마사지", "사우나·찜질방", "각질 제거 스크럽·필링 제품"],
    basic_care: ["저자극 보습 집중", "자외선 차단제 재도포", "가벼운 산책 정도의 활동은 무방"],
    next_check_offset_days: 4,
  },
  {
    care_type: "energy_lifting",
    elapsed_range_start: 4,
    elapsed_range_end: 7,
    elapsed_range_label: "4-7",
    must_avoid: ["고강도 근력·유산소 운동", "시술 부위를 반복적으로 압박하는 자세(엎드려 자기 등)"],
    basic_care: [
      "콜라겐 재생이 시작되는 시기 — 각질 제거·필링은 다음 관리 때까지 미루기",
      "보습·자외선 차단 꾸준히 유지",
      "일시적으로 붓기·처지는 느낌이 들 수 있으나 정상적인 회복 과정",
    ],
    next_check_offset_days: 8,
  },
  {
    care_type: "energy_lifting",
    elapsed_range_start: 8,
    elapsed_range_end: 14,
    elapsed_range_label: "8-14",
    must_avoid: [],
    basic_care: [
      "콜라겐 리모델링이 진행 중인 단계 — 눈에 띄는 탄력 개선은 보통 4~12주에 걸쳐 서서히 나타남",
      "자외선 차단제·보습 계속 유지",
      "남은 붓기·멍은 냉찜질로 완화 가능",
    ],
    next_check_offset_days: 15,
  },
  {
    care_type: "energy_lifting",
    elapsed_range_start: 15,
    elapsed_range_end: 30,
    elapsed_range_label: "15-30",
    must_avoid: [],
    basic_care: [
      "리프팅 효과가 이 시점부터 점차 체감되기 시작 — 결과 판단은 4주 이후 권장",
      "자외선 차단제 유지",
      "정기 관리로 효과 연장 가능",
    ],
    next_check_offset_days: null,
  },
  {
    care_type: "botox",
    elapsed_range_start: 0,
    elapsed_range_end: 1,
    elapsed_range_label: "0-1",
    must_avoid: [
      "당일 시술 부위 마사지·압박",
      "당일 4시간 이내 눕거나 엎드리기",
      "당일 음주",
      "당일 격한 운동·사우나",
      "과도하게 찡그리거나 반복적으로 힘주는 표정",
    ],
    basic_care: ["시술 부위 청결 유지", "평소보다 가벼운 표정 짓기(약물이 자리잡는 데 도움)", "붓기 있으면 냉찜질"],
    next_check_offset_days: 2,
  },
  {
    care_type: "botox",
    elapsed_range_start: 2,
    elapsed_range_end: 3,
    elapsed_range_label: "2-3",
    must_avoid: ["시술 부위 마사지·문지르기", "사우나·찜질방"],
    basic_care: ["평소 표정 습관 자연스럽게 유지", "자외선 차단제 사용"],
    next_check_offset_days: 4,
  },
  {
    care_type: "botox",
    elapsed_range_start: 4,
    elapsed_range_end: 7,
    elapsed_range_label: "4-7",
    must_avoid: [],
    basic_care: ["보통 3~7일 사이 효과가 나타나기 시작하는 시기", "좌우 비대칭 등 이상이 느껴지면 관찰해두기"],
    next_check_offset_days: 8,
  },
  {
    care_type: "botox",
    elapsed_range_start: 8,
    elapsed_range_end: 14,
    elapsed_range_label: "8-14",
    must_avoid: ["2주 이전에 효과 부족을 이유로 추가 시술 요청"],
    basic_care: [
      "보통 시술 후 2주 전후로 최대 효과가 나타남",
      "이 시점 이후에도 비대칭·효과 미흡이 느껴지면 재방문 상담 권장",
    ],
    next_check_offset_days: 15,
  },
  {
    care_type: "botox",
    elapsed_range_start: 15,
    elapsed_range_end: 30,
    elapsed_range_label: "15-30",
    must_avoid: [],
    basic_care: ["효과 안정화 시기", "지속 기간은 보통 3~4개월 — 다음 관리 시점 미리 계획하면 좋음"],
    next_check_offset_days: null,
  },
  {
    care_type: "filler",
    elapsed_range_start: 0,
    elapsed_range_end: 1,
    elapsed_range_label: "0-1",
    must_avoid: ["당일 시술 부위 압박·마사지", "당일 사우나·찜질방", "당일 음주", "고강도 운동"],
    basic_care: [
      "냉찜질로 붓기·멍 완화(수건에 감싸서 간접 접촉)",
      "충분한 수분 섭취",
      "붓기·멍은 시술 직후 자연스러운 반응",
    ],
    next_check_offset_days: 2,
  },
  {
    care_type: "filler",
    elapsed_range_start: 2,
    elapsed_range_end: 3,
    elapsed_range_label: "2-3",
    must_avoid: ["시술 부위 강한 압박", "격한 운동"],
    basic_care: ["냉찜질 계속 가능(필요시)", "충분한 수분 섭취 유지"],
    next_check_offset_days: 4,
  },
  {
    care_type: "filler",
    elapsed_range_start: 4,
    elapsed_range_end: 7,
    elapsed_range_label: "4-7",
    must_avoid: [],
    basic_care: [
      "붓기 대부분 감소하는 시기 — 필러가 자리잡는 과정에서 눌림·뭉침이 느껴질 수 있음(정상 범위)",
      "평소 스킨케어 루틴 복귀 가능",
    ],
    next_check_offset_days: 8,
  },
  {
    care_type: "filler",
    elapsed_range_start: 8,
    elapsed_range_end: 14,
    elapsed_range_label: "8-14",
    must_avoid: [],
    basic_care: ["최종 형태로 안정화되는 시기", "비대칭·뭉침이 계속 남아있으면 재방문 상담 권장"],
    next_check_offset_days: 15,
  },
  {
    care_type: "filler",
    elapsed_range_start: 15,
    elapsed_range_end: 30,
    elapsed_range_label: "15-30",
    must_avoid: [],
    basic_care: ["최종 결과 확인 시기", "지속 기간은 부위·제품에 따라 6개월~2년으로 다양"],
    next_check_offset_days: null,
  },
  {
    care_type: "skin_booster",
    elapsed_range_start: 0,
    elapsed_range_end: 1,
    elapsed_range_label: "0-1",
    must_avoid: ["당일 메이크업", "당일 사우나·찜질방", "당일 격한 운동", "시술 부위 문지르기"],
    basic_care: [
      "미온수 세안",
      "저자극 보습제 사용",
      "자외선 차단제 필수",
      "붉은기·미세 붓기는 자연스러운 반응",
    ],
    next_check_offset_days: 2,
  },
  {
    care_type: "skin_booster",
    elapsed_range_start: 2,
    elapsed_range_end: 3,
    elapsed_range_label: "2-3",
    must_avoid: ["각질 제거 제품·스크럽"],
    basic_care: ["저자극 보습 유지", "자외선 차단제 재도포"],
    next_check_offset_days: 4,
  },
  {
    care_type: "skin_booster",
    elapsed_range_start: 4,
    elapsed_range_end: 7,
    elapsed_range_label: "4-7",
    must_avoid: ["필링·레이저 등 자극이 큰 시술 병행"],
    basic_care: ["콜라겐 자극이 시작되는 시기 — 보습 집중 관리", "평소 스킨케어 루틴 서서히 복귀 가능"],
    next_check_offset_days: 8,
  },
  {
    care_type: "skin_booster",
    elapsed_range_start: 8,
    elapsed_range_end: 14,
    elapsed_range_label: "8-14",
    must_avoid: [],
    basic_care: ["피부결·탄력 개선이 서서히 체감되기 시작하는 시기", "꾸준한 보습·자외선 차단이 결과에 영향"],
    next_check_offset_days: 15,
  },
  {
    care_type: "skin_booster",
    elapsed_range_start: 15,
    elapsed_range_end: 30,
    elapsed_range_label: "15-30",
    must_avoid: [],
    basic_care: ["효과가 누적되는 시기 — 통상 3~4주 간격 반복 관리 시 효과 상승", "정기 관리 권장"],
    next_check_offset_days: null,
  },
  {
    care_type: "hair_removal",
    elapsed_range_start: 0,
    elapsed_range_end: 1,
    elapsed_range_label: "0-1",
    must_avoid: ["당일 직사광선 노출", "당일 사우나·찜질방·뜨거운 물 샤워", "시술 부위 마찰(꽉 끼는 옷 등)"],
    basic_care: ["저자극 보습", "자외선 차단제 필수", "붉은기·따끔거림은 자연스러운 반응"],
    next_check_offset_days: 2,
  },
  {
    care_type: "hair_removal",
    elapsed_range_start: 2,
    elapsed_range_end: 3,
    elapsed_range_label: "2-3",
    must_avoid: ["왁싱·제모크림 등 다른 제모 방법 병행", "각질 제거 제품"],
    basic_care: ["저자극 보습 유지"],
    next_check_offset_days: 4,
  },
  {
    care_type: "hair_removal",
    elapsed_range_start: 4,
    elapsed_range_end: 7,
    elapsed_range_label: "4-7",
    must_avoid: ["시술 부위 마찰"],
    basic_care: ["모낭염 예방을 위해 청결 유지", "자외선 차단제 유지"],
    next_check_offset_days: 8,
  },
  {
    care_type: "hair_removal",
    elapsed_range_start: 8,
    elapsed_range_end: 14,
    elapsed_range_label: "8-14",
    must_avoid: ["털을 억지로 뽑거나 짜내기"],
    basic_care: ["이 시기 남은 털이 자연스럽게 빠지는 탈락기 — 가려움은 정상 반응", "평소 루틴 복귀 가능"],
    next_check_offset_days: 15,
  },
  {
    care_type: "hair_removal",
    elapsed_range_start: 15,
    elapsed_range_end: 30,
    elapsed_range_label: "15-30",
    must_avoid: [],
    basic_care: ["모발 주기에 따라 통상 4~6주 간격 반복 관리 권장", "정기 관리 권장"],
    next_check_offset_days: null,
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
          care_type: record.careType,
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

  console.log("[seed] reference_guides 등록 중...");
  // 2026-08-18: botox/filler/energy_lifting/skin_booster/hair_removal을 0-30 단일 구간에서
  // 5구간으로 세분화하며 옛 0-30 스텁 행이 orphan으로 남는다 — upsert의 onConflict 키
  // (care_type,elapsed_range_start,elapsed_range_end)와 안 겹쳐서 자동 정리가 안 되고, 그대로 두면
  // findReferenceGuide()의 .maybeSingle()이 "여러 행 매칭"으로 에러나 daily-guide/questions가
  // 이 5종 전체에서 조용히 폴백/실패하게 된다. 새 구간 upsert 전에 먼저 지운다.
  const SPLIT_CARE_TYPES = ["energy_lifting", "botox", "filler", "skin_booster", "hair_removal"];
  await supabase
    .from("reference_guides")
    .delete()
    .in("care_type", SPLIT_CARE_TYPES)
    .eq("elapsed_range_start", 0)
    .eq("elapsed_range_end", 30);

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
