import { randomBytes } from "node:crypto";
import { supabaseAdmin } from "../config/supabase";
import { BODY_PARTS } from "../lib/bodyParts";
import { Errors } from "../lib/errors";

// 관리 부위 고정 목록 — 정적 상수라 DB 조회 없이 바로 반환한다.
export function listBodyParts() {
  return [...BODY_PARTS];
}

function generatePatientNo() {
  // EMR-P-XXXXXX (병원 차트번호 느낌의 사람이 읽기 쉬운 형태). 충돌 시 호출부에서 재시도한다.
  return `EMR-P-${randomBytes(3).toString("hex").toUpperCase()}`;
}

// 등록하면 인증코드 없이 환자번호(patientNo)만 발급한다 — 회원가입은 patientNo+이름+생년월일
// 조합으로 신원을 확인하는 방식으로 바뀌어서(server/의 signup()) 별도 코드 발급이 필요 없다.
export async function createPatient(
  input: {
    name: string;
    birthDate: string;
    phone: string;
    notes?: string;
  },
  brand: string,
) {
  // 이름+생년월일+전화번호가 전부 일치하는 환자가 이 클리닉에 이미 등록돼 있으면 새로 만들지 않고 그
  // 환자를 그대로 재사용한다(접수 직원이 같은 환자를 실수로 중복 등록하는 걸 막기 위함). 앱 회원가입
  // 여부(claimed_user_id)는 여기서 볼 필요가 없다 — emr_patients에 있는지만 확인하면 됨. 다른 클리닉의
  // 등록 여부는 확인하지 않는다(브랜드 격리 원칙 — 다른 클리닉 데이터의 존재를 알려주지 않음).
  // 재방문 사이에 기타사항(알러지 등)이 바뀌었을 수 있으니, notes가 새로 입력한 값과 다르면 그 자리에서
  // 갱신해서 기존 환자 데이터가 최신 상태를 반영하게 한다.
  const { data: existing, error: existingError } = await supabaseAdmin
    .from("emr_patients")
    .select("*")
    .eq("brand", brand)
    .eq("name", input.name)
    .eq("birth_date", input.birthDate)
    .eq("phone", input.phone)
    .maybeSingle();
  if (existingError) throw Errors.internal(existingError.message);
  if (existing) {
    const newNotes = input.notes ?? null;
    if (newNotes === existing.notes) return { patient: existing, duplicate: true };

    const { data: updated, error: updateError } = await supabaseAdmin
      .from("emr_patients")
      .update({ notes: newNotes, updated_at: new Date().toISOString() })
      .eq("id", existing.id)
      .select()
      .single();
    if (updateError) throw Errors.internal(updateError.message);
    return { patient: updated, duplicate: true };
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    const patientNo = generatePatientNo();
    const { data, error } = await supabaseAdmin
      .from("emr_patients")
      .insert({
        patient_no: patientNo,
        name: input.name,
        birth_date: input.birthDate,
        phone: input.phone,
        notes: input.notes ?? null,
        brand,
      })
      .select()
      .single();

    if (!error) return { patient: data, duplicate: false };
    // 23505 = unique_violation (patient_no 충돌) — 새 번호로 재시도
    if (error.code !== "23505") throw Errors.internal(error.message);
  }
  throw Errors.internal("환자번호 발급에 실패했습니다. 다시 시도해주세요.");
}

// 로그인한 클리닉(brand)이 등록한 환자만 보인다 — 다른 클리닉 환자는 검색해도 나오지 않는다.
// 목록 화면에서 "환자이름/클리닉/최근 받은 시술"을 바로 보여줄 수 있도록 최근 시술명(latestCareName)도
// 함께 내려준다 — 시술 이력이 없으면 null(프론트에서 빈칸 처리). 회원가입(claim)한 환자는 그 이후
// 시술이 emr_care_records가 아니라 실제 care_records에 쌓이므로(아래 addCareRecord 참고) 그쪽도 같이 봐야
// "최근 시술"이 정확하다.
export async function listPatients(brand: string, search?: string) {
  let query = supabaseAdmin
    .from("emr_patients")
    .select("id, patient_no, name, birth_date, phone, brand, claimed_user_id, claimed_at, created_at")
    .eq("brand", brand)
    .order("created_at", { ascending: false });

  if (search) {
    query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%,patient_no.ilike.%${search}%`);
  }

  const { data: patients, error } = await query;
  if (error) throw Errors.internal(error.message);
  if (!patients || patients.length === 0) return [];

  // care_date만 비교하면 같은 날짜에 시술이 여러 건이어도 어느 게 진짜 최근인지 못 가려서(둘 다 날짜가
  // 같으면 먼저 본 것이 그대로 남는 버그), created_at(실제 기록 등록 시각)까지 함께 비교해 동점을 깬다.
  function isMoreRecent(a: { date: string; createdAt: string }, b: { date: string; createdAt: string }) {
    if (a.date !== b.date) return a.date > b.date;
    return a.createdAt > b.createdAt;
  }

  const { data: emrCareRecords, error: careError } = await supabaseAdmin
    .from("emr_care_records")
    .select("patient_id, care_name, care_date, created_at")
    .in(
      "patient_id",
      patients.map((p) => p.id),
    );
  if (careError) throw Errors.internal(careError.message);

  const latestByPatient = new Map<string, { name: string; date: string; createdAt: string }>();
  for (const record of emrCareRecords ?? []) {
    const candidate = { name: record.care_name, date: record.care_date, createdAt: record.created_at };
    const existing = latestByPatient.get(record.patient_id);
    if (!existing || isMoreRecent(candidate, existing)) {
      latestByPatient.set(record.patient_id, candidate);
    }
  }

  const claimedUserIds = patients.filter((p) => p.claimed_user_id).map((p) => p.claimed_user_id as string);
  if (claimedUserIds.length > 0) {
    const { data: appCareRecords, error: appCareError } = await supabaseAdmin
      .from("care_records")
      .select("user_id, care_name, care_date, created_at")
      .in("user_id", claimedUserIds)
      .eq("brand", brand);
    if (appCareError) throw Errors.internal(appCareError.message);

    const patientIdByUserId = new Map(
      patients.filter((p) => p.claimed_user_id).map((p) => [p.claimed_user_id as string, p.id]),
    );
    for (const record of appCareRecords ?? []) {
      const patientId = patientIdByUserId.get(record.user_id);
      if (!patientId) continue;
      const candidate = { name: record.care_name, date: record.care_date, createdAt: record.created_at };
      const existing = latestByPatient.get(patientId);
      if (!existing || isMoreRecent(candidate, existing)) {
        latestByPatient.set(patientId, candidate);
      }
    }
  }

  return patients.map((p) => ({ ...p, latestCareName: latestByPatient.get(p.id)?.name ?? null }));
}

// 다른 클리닉 환자를 id로 직접 찍어 조회하는 것도 막는다 — 존재 자체를 숨기기 위해 403이 아니라 404로 통일.
async function findPatientOrThrow(patientId: string, brand: string) {
  const { data, error } = await supabaseAdmin.from("emr_patients").select("*").eq("id", patientId).maybeSingle();
  if (error) throw Errors.internal(error.message);
  if (!data || data.brand !== brand) throw Errors.patientNotFound();
  return data;
}

// 회원가입(claim) 이후엔 이 환자의 시술기록/이용권이 emr_* 스테이징이 아니라 실제 앱 테이블
// (care_records/memberships)에 쌓인다(addCareRecord 참고) — 그래서 상세 조회도 claim 여부에 따라
// 두 곳을 합쳐서 보여준다. 각 항목에 source("emr"|"app")를 붙여 어느 쪽 데이터인지 구분할 수 있게 한다.
// memberships는 실제 테이블에 brand 컬럼이 없어(고객이 여러 클리닉을 다닐 수 있어 원래 특정 클리닉
// 소유가 아님) 이 고객의 이용권 전체를 보여준다 — care_records는 brand로 이 클리닉 방문분만 걸러낸다.
export async function getPatient(patientId: string, brand: string) {
  const patient = await findPatientOrThrow(patientId, brand);

  const [{ data: emrCareRecords, error: emrCareError }, { data: emrMemberships, error: emrMemError }] = await Promise.all([
    supabaseAdmin
      .from("emr_care_records")
      .select("*")
      .eq("patient_id", patientId)
      .order("care_date", { ascending: false }),
    supabaseAdmin.from("emr_memberships").select("*").eq("patient_id", patientId).order("created_at", { ascending: false }),
  ]);
  if (emrCareError) throw Errors.internal(emrCareError.message);
  if (emrMemError) throw Errors.internal(emrMemError.message);

  let careRecords = (emrCareRecords ?? []).map((r) => ({ ...r, source: "emr" as const }));
  let memberships = (emrMemberships ?? []).map((m) => ({ ...m, source: "emr" as const }));

  if (patient.claimed_user_id) {
    const [{ data: appCareRecords, error: appCareError }, { data: appMemberships, error: appMemError }] = await Promise.all([
      supabaseAdmin
        .from("care_records")
        .select("*")
        .eq("user_id", patient.claimed_user_id)
        .eq("brand", brand)
        .order("care_date", { ascending: false }),
      supabaseAdmin
        .from("memberships")
        .select("*")
        .eq("user_id", patient.claimed_user_id)
        .order("created_at", { ascending: false }),
    ]);
    if (appCareError) throw Errors.internal(appCareError.message);
    if (appMemError) throw Errors.internal(appMemError.message);

    careRecords = [...(appCareRecords ?? []).map((r) => ({ ...r, source: "app" as const })), ...careRecords].sort((a, b) =>
      a.care_date < b.care_date ? 1 : -1,
    );
    memberships = [...(appMemberships ?? []).map((m) => ({ ...m, source: "app" as const })), ...memberships].sort((a, b) =>
      a.created_at < b.created_at ? 1 : -1,
    );
  }

  return { patient, careRecords, memberships };
}

export async function updatePatient(
  patientId: string,
  input: Partial<{
    name: string;
    birthDate: string;
    phone: string;
    notes: string;
  }>,
  brand: string,
) {
  await findPatientOrThrow(patientId, brand);

  const { data, error } = await supabaseAdmin
    .from("emr_patients")
    .update({
      ...(input.name !== undefined && { name: input.name }),
      ...(input.birthDate !== undefined && { birth_date: input.birthDate }),
      ...(input.phone !== undefined && { phone: input.phone }),
      ...(input.notes !== undefined && { notes: input.notes }),
      updated_at: new Date().toISOString(),
    })
    .eq("id", patientId)
    .select()
    .single();

  if (error) throw Errors.internal(error.message);
  return data;
}

type MembershipTable = "emr_memberships" | "memberships";
type CareRecordTable = "emr_care_records" | "care_records";

// 기존 이용권에서 1회 차감. 다른 소유이거나 잔여 횟수가 없으면 막는다.
// ownerColumn/ownerId: 회원가입 전엔 emr_memberships.patient_id, 회원가입 후엔 memberships.user_id.
async function deductMembershipSession(
  table: MembershipTable,
  ownerColumn: "patient_id" | "user_id",
  ownerId: string,
  membershipId: string,
  careDate: string,
) {
  const { data: membership, error } = await supabaseAdmin.from(table).select("*").eq("id", membershipId).maybeSingle();
  if (error) throw Errors.internal(error.message);
  if (!membership || membership[ownerColumn] !== ownerId) throw Errors.membershipNotFound();
  if (membership.used_count >= membership.total_count) throw Errors.membershipExhausted();
  if (membership.expires_at && membership.expires_at < careDate) throw Errors.membershipExpired();

  const { data, error: updateError } = await supabaseAdmin
    .from(table)
    .update({ used_count: membership.used_count + 1, last_used_at: careDate })
    .eq("id", membershipId)
    .select()
    .single();

  if (updateError) throw Errors.internal(updateError.message);
  return data;
}

// 이용권 만료일 = 생성일(=첫 시술일, careDate) + 1년. 날짜 문자열(YYYY-MM-DD) 그대로 연산해
// 타임존 이슈 없이 처리한다.
function addOneYear(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const next = new Date(Date.UTC(y + 1, m - 1, d));
  return next.toISOString().slice(0, 10);
}

// "직접 입력" — 시술기록을 추가하면서 그 자리에서 새 이용권을 만들고 1회차를 바로 사용 처리한다.
// 만료일은 이 이용권의 생성일(=첫 시술일) 기준 +1년으로 고정(이후 재방문으로 만료일이 계속 밀리지 않음).
async function createMembershipFromCareRecord(
  table: MembershipTable,
  ownerColumn: "patient_id" | "user_id",
  ownerId: string,
  careName: string,
  totalSessions: number,
  careDate: string,
) {
  const { data, error } = await supabaseAdmin
    .from(table)
    .insert({
      [ownerColumn]: ownerId,
      product_name: careName,
      total_count: totalSessions,
      used_count: 1,
      expires_at: addOneYear(careDate),
      last_used_at: careDate,
      available_care_names: [careName],
    })
    .select()
    .single();

  if (error) throw Errors.internal(error.message);
  return data;
}

// 같은 치료명+같은 횟수권으로 이미 갖고 있는(아직 소진·만료 안 된) 이용권이 있으면 그걸 찾아 이어서
// 차감할 수 있게 한다(관리자 프로토타입의 "패키지 자동 이어쓰기" 동작). 여러 개면 먼저 산 것부터 소진.
async function findContinuableMembership(
  table: MembershipTable,
  ownerColumn: "patient_id" | "user_id",
  ownerId: string,
  careName: string,
  totalSessions: number,
  careDate: string,
) {
  const { data, error } = await supabaseAdmin
    .from(table)
    .select("*")
    .eq(ownerColumn, ownerId)
    .eq("product_name", careName)
    .eq("total_count", totalSessions)
    .order("created_at", { ascending: true });
  if (error) throw Errors.internal(error.message);

  return (
    (data ?? []).find(
      (m) => m.used_count < m.total_count && (!m.expires_at || m.expires_at >= careDate),
    ) ?? null
  );
}

// careType은 관리자가 자유 입력하는 값이 아니라, 전문가 검수를 거쳐 reference_guides에 실제로
// 등록된 가이드 카테고리 중에서만 고를 수 있어야 한다(그래야 daily-guide가 항상 응답 가능함이 보장됨).
// reference_guides는 클리닉 공통 자료라 브랜드 격리 대상이 아니다.
export async function listCareTypes() {
  const { data, error } = await supabaseAdmin.from("reference_guides").select("care_type");
  if (error) throw Errors.internal(error.message);
  return [...new Set((data ?? []).map((row) => row.care_type as string))].sort();
}

export async function assertValidCareType(careType: string) {
  const { data, error } = await supabaseAdmin
    .from("reference_guides")
    .select("care_type")
    .eq("care_type", careType)
    .limit(1)
    .maybeSingle();
  if (error) throw Errors.internal(error.message);
  if (!data) throw Errors.invalidCareType();
}

// 회원가입(claim) 여부에 따라 어느 테이블에 쓸지 정한다 — claim 전이면 emr_* 스테이징,
// claim 후면 실제 앱 테이블(care_records/memberships)에 곧바로 기록한다. 예전엔 claim된 환자에
// 새 시술기록 자체를 막았지만(1회성 이관), 재방문 고객의 시술을 기록할 방법이 없어지는 문제가 있어
// 이제는 claim 여부와 무관하게 항상 기록 가능하도록 바꿨다.
export async function addCareRecord(
  patientId: string,
  input: {
    careName: string;
    careType: string;
    careDate: string;
    partOfBody: string[];
    practitioner?: string;
    basicAftercareGuide: string[];
    doctorComment?: string;
    membershipId?: string;
    totalSessions?: number;
  },
  brand: string,
) {
  const patient = await findPatientOrThrow(patientId, brand);
  await assertValidCareType(input.careType);

  const claimed = !!patient.claimed_user_id;
  const membershipTable: MembershipTable = claimed ? "memberships" : "emr_memberships";
  const careRecordTable: CareRecordTable = claimed ? "care_records" : "emr_care_records";
  const ownerColumn = claimed ? "user_id" : "patient_id";
  const ownerId = claimed ? (patient.claimed_user_id as string) : patientId;

  // membershipId를 직접 고르면 그 이용권에서 차감. totalSessions만 왔으면(=패키지 구매) 같은
  // 치료명+같은 횟수권으로 아직 유효한 이용권을 먼저 찾아 이어서 차감하고, 없을 때만 새로 만든다.
  let membershipCreated = false;
  const membership = input.membershipId
    ? await deductMembershipSession(membershipTable, ownerColumn, ownerId, input.membershipId, input.careDate)
    : await (async () => {
        const continuable = await findContinuableMembership(
          membershipTable,
          ownerColumn,
          ownerId,
          input.careName,
          input.totalSessions!,
          input.careDate,
        );
        if (continuable) {
          return deductMembershipSession(membershipTable, ownerColumn, ownerId, continuable.id, input.careDate);
        }
        membershipCreated = true;
        return createMembershipFromCareRecord(
          membershipTable,
          ownerColumn,
          ownerId,
          input.careName,
          input.totalSessions!,
          input.careDate,
        );
      })();

  const insertPayload: Record<string, unknown> = {
    [ownerColumn]: ownerId,
    care_name: input.careName,
    care_type: input.careType,
    care_date: input.careDate,
    part_of_body: input.partOfBody,
    // brand는 수동 입력이 아니라 로그인한 클리닉 계정에서 그대로 가져온다(수동 선택 시 실수로
    // 다른 클리닉을 고를 수 있는 여지를 아예 없앤다).
    brand,
    practitioner: input.practitioner ?? null,
    basic_aftercare_guide: input.basicAftercareGuide,
    doctor_comment: input.doctorComment ?? null,
    session_number: membership.used_count,
    total_sessions: membership.total_count,
    // 삭제 시 이 이용권을 함께 정리(차감 취소/이용권 삭제)하기 위한 연결.
    membership_id: membership.id,
  };
  if (claimed) {
    insertPayload.source_system = "aac_emr";
    insertPayload.synced_at = new Date().toISOString();
  }

  const { data, error } = await supabaseAdmin.from(careRecordTable).insert(insertPayload).select().single();
  if (error) throw Errors.internal(error.message);
  return {
    careRecord: data,
    membership,
    source: claimed ? ("app" as const) : ("emr" as const),
    // membershipId를 직접 골랐거나, 이어서 차감할 기존 이용권을 찾았으면 false. 진짜 새로 만들었을 때만 true.
    membershipCreated,
  };
}

// 시술기록을 지우면 그 기록이 소비한 이용권도 함께 정리한다(별도 "이용권 삭제" API는 없음) —
// 이 기록이 그 이용권의 유일한 소비 기록이었으면(직접입력으로 막 만든 이용권) 이용권 자체를 삭제하고,
// 다른 기록도 그 이용권을 쓰고 있었으면(기존 이용권에서 차감한 경우) used_count만 1 되돌린다.
// careRecordId가 emr_care_records 소속인지 care_records 소속인지 모르니(claim 여부에 따라 갈림)
// emr 쪽을 먼저 찾아보고 없으면 앱 쪽을 찾는 순서로 처리한다.
async function tryDeleteCareRecordFrom(
  careRecordTable: CareRecordTable,
  membershipTable: MembershipTable,
  careRecordId: string,
  brand: string,
) {
  const { data: record, error } = await supabaseAdmin
    .from(careRecordTable)
    .select("id, membership_id, brand")
    .eq("id", careRecordId)
    .maybeSingle<{ id: string; membership_id: string | null; brand: string | null }>();
  if (error) throw Errors.internal(error.message);
  if (!record || record.brand !== brand) return false;

  const { error: deleteError } = await supabaseAdmin.from(careRecordTable).delete().eq("id", careRecordId);
  if (deleteError) throw Errors.internal(deleteError.message);

  if (!record.membership_id) return true;

  const { count, error: countError } = await supabaseAdmin
    .from(careRecordTable)
    .select("id", { count: "exact", head: true })
    .eq("membership_id", record.membership_id);
  if (countError) throw Errors.internal(countError.message);

  if (count === 0) {
    const { error: deleteMembershipError } = await supabaseAdmin
      .from(membershipTable)
      .delete()
      .eq("id", record.membership_id);
    if (deleteMembershipError) throw Errors.internal(deleteMembershipError.message);
    return true;
  }

  const { data: membership, error: membershipError } = await supabaseAdmin
    .from(membershipTable)
    .select("used_count")
    .eq("id", record.membership_id)
    .maybeSingle();
  if (membershipError) throw Errors.internal(membershipError.message);
  if (!membership) return true;

  const { error: updateError } = await supabaseAdmin
    .from(membershipTable)
    .update({ used_count: Math.max(0, membership.used_count - 1) })
    .eq("id", record.membership_id);
  if (updateError) throw Errors.internal(updateError.message);
  return true;
}

export async function deleteCareRecord(careRecordId: string, brand: string) {
  const deletedFromEmr = await tryDeleteCareRecordFrom("emr_care_records", "emr_memberships", careRecordId, brand);
  if (deletedFromEmr) return;

  const deletedFromApp = await tryDeleteCareRecordFrom("care_records", "memberships", careRecordId, brand);
  if (deletedFromApp) return;

  throw Errors.careRecordNotFound();
}

// KST(한국 시간) 기준 오늘로부터 daysAgo일 전 날짜를 YYYY-MM-DD로(음수를 넣으면 이후 날짜, 예:
// daysAgo=-1은 내일). server/의 aftercare.service.ts와 동일한 패턴(toLocaleString으로 KST 시각을
// 만든 뒤 그 위에서 날짜 계산) — 서버가 어느 시간대에서 돌아가든 "한국 기준 오늘"이 안정적으로 나온다.
function kstDateString(daysAgo: number): string {
  const now = new Date();
  const kstNow = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  kstNow.setDate(kstNow.getDate() - daysAgo);
  return kstNow.toLocaleDateString("en-CA");
}

// 전날/금일 방문 + 익일 예약 고객 수 — 그 날짜에 시술기록이 있는 "실제 사람 수"(중복 제거, 시술 건수
// 아님). 회원가입 전 고객은 emr_care_records, 회원가입 후 고객은 care_records에 각각 기록되므로
// (addCareRecord 참고) 둘 다 조회해서 합친다. "익일"은 아직 시행 전이라 "방문"이 아니라 "예약"으로
// 부르지만, 데이터 원본은 같은 시술기록 테이블이다 — care_date를 미래로 등록하면(관리 등록 화면의
// "관리 날짜"에 내일 이후를 선택) 그 자체로 예약이 된다(별도 "예약" 테이블·엔드포인트 불필요, 관리
// 등록 API가 이미 미래 날짜를 막지 않는다).
//
// 주의: 환자가 "당일 방문 기록(emr) → 당일 회원가입" 순서를 밟으면, claim 시 그 방문 기록이
// care_records로 1회성 복사되기 때문에(server/의 signup()) 같은 사람의 같은 방문이 emr_care_records와
// care_records 양쪽에 동시에 남을 수 있다. 그래서 patient_id/user_id를 그냥 더하면 같은 사람을
// 두 번 세는 문제가 생긴다(실측으로 확인됨) — emr_patients.claimed_user_id로 "이미 가입한 환자"를
// user_id 기준으로 환산해서 두 집합을 하나의 identity Set으로 합친 뒤 크기를 센다.
export async function getVisitStats(brand: string) {
  const days = [
    { key: "yesterday", date: kstDateString(1) },
    { key: "today", date: kstDateString(0) },
    { key: "tomorrow", date: kstDateString(-1) },
  ] as const;
  const dateList = days.map((d) => d.date);

  const [{ data: emrRows, error: emrError }, { data: appRows, error: appError }] = await Promise.all([
    supabaseAdmin
      .from("emr_care_records")
      .select("patient_id, care_date, patient:emr_patients(claimed_user_id)")
      .eq("brand", brand)
      .in("care_date", dateList)
      .returns<{ patient_id: string; care_date: string; patient: { claimed_user_id: string | null } | null }[]>(),
    supabaseAdmin.from("care_records").select("user_id, care_date").eq("brand", brand).in("care_date", dateList),
  ]);
  if (emrError) throw Errors.internal(emrError.message);
  if (appError) throw Errors.internal(appError.message);

  const result: Record<string, { date: string; count: number }> = {};
  for (const { key, date } of days) {
    const identities = new Set<string>();
    for (const row of emrRows ?? []) {
      if (row.care_date !== date) continue;
      // 이미 회원가입한 환자면 user_id로 환산해서 센다 — care_records 쪽 같은 사람과 하나로 합쳐지도록.
      identities.add(row.patient?.claimed_user_id ?? row.patient_id);
    }
    for (const row of appRows ?? []) {
      if (row.care_date === date) identities.add(row.user_id);
    }
    result[key] = { date, count: identities.size };
  }
  return result;
}

// 특정 날짜(미지정 시 오늘)의 예약(=그 날짜 careDate를 가진 시술기록) 목록 — 대시보드의
// 어제/오늘/내일 카드를 클릭해 "누구를 예약 취소할지" 고를 수 있도록 careRecordId까지 내려준다.
// 실제 취소는 이 목록에서 careRecordId를 골라 기존 DELETE /care-records/:careRecordId를 그대로 쓴다
// (별도 "취소" 엔드포인트 없음 — 취소=삭제, 이용권 환불까지 기존 로직이 그대로 처리).
export async function listReservations(brand: string, date?: string) {
  const targetDate = date ?? kstDateString(0);

  const [{ data: emrRows, error: emrError }, { data: appRows, error: appError }] = await Promise.all([
    supabaseAdmin
      .from("emr_care_records")
      .select("id, care_name, care_date, patient:emr_patients(name, phone)")
      .eq("brand", brand)
      .eq("care_date", targetDate)
      .returns<
        { id: string; care_name: string; care_date: string; patient: { name: string; phone: string } | null }[]
      >(),
    supabaseAdmin
      .from("care_records")
      .select("id, care_name, care_date, user_id")
      .eq("brand", brand)
      .eq("care_date", targetDate)
      .returns<{ id: string; care_name: string; care_date: string; user_id: string }[]>(),
  ]);
  if (emrError) throw Errors.internal(emrError.message);
  if (appError) throw Errors.internal(appError.message);

  // care_records.user_id는 profiles와 직접 FK 임베드가 안 돼(둘 다 auth.users만 참조) 별도 조회 후 병합.
  const appUserIds = [...new Set((appRows ?? []).map((r) => r.user_id))];
  const profilesById = new Map<string, { name: string; phone: string | null }>();
  if (appUserIds.length > 0) {
    const { data: profiles, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("user_id, name, phone")
      .in("user_id", appUserIds);
    if (profileError) throw Errors.internal(profileError.message);
    for (const p of profiles ?? []) profilesById.set(p.user_id, { name: p.name, phone: p.phone });
  }

  const items = [
    ...(emrRows ?? []).map((r) => ({
      careRecordId: r.id,
      careName: r.care_name,
      careDate: r.care_date,
      patientName: r.patient?.name ?? null,
      phone: r.patient?.phone ?? null,
      source: "emr" as const,
    })),
    ...(appRows ?? []).map((r) => ({
      careRecordId: r.id,
      careName: r.care_name,
      careDate: r.care_date,
      patientName: profilesById.get(r.user_id)?.name ?? null,
      phone: profilesById.get(r.user_id)?.phone ?? null,
      source: "app" as const,
    })),
  ];

  return { date: targetDate, items };
}
