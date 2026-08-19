import { randomBytes } from "node:crypto";
import { supabaseAdmin } from "../config/supabase";
import { BODY_PARTS } from "../lib/bodyParts";
import { Errors } from "../lib/errors";
import { sendCareRegisteredPush } from "./push.service";

// 관리 부위 고정 목록 — 정적 상수라 DB 조회 없이 바로 반환한다.
export function listBodyParts() {
  return [...BODY_PARTS];
}

function generatePatientNo() {
  // EMR-P-XXXXXX (병원 차트번호 느낌의 사람이 읽기 쉬운 형태). 충돌 시 호출부에서 재시도한다.
  return `EMR-P-${randomBytes(3).toString("hex").toUpperCase()}`;
}

// 다른 클리닉(브랜드)에 이미 등록·회원가입까지 끝난 "같은 사람"인지 확인한다 — 이름+생년월일+
// 전화번호가 일치하는 다른 브랜드의 emr_patients 행 중 이미 앱 계정에 연결된(claimed_user_id
// not null) 것이 있으면 그 userId를 반환한다. AAC 산하 여러 클리닉이 같은 앱을 공유하는 구조라,
// 이 값이 있으면 이번에 새로 만드는 행을 처음부터 그 계정에 바로 연결(claim)해서 별도 회원가입
// 없이도 이 클리닉이 곧바로 실제 계정에 시술기록을 쓸 수 있게 한다(아래 createPatient 참고).
async function findLinkedAccountFromOtherClinic(
  input: { name: string; birthDate: string; phone: string },
  brand: string,
): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from("emr_patients")
    .select("claimed_user_id")
    .neq("brand", brand)
    .eq("name", input.name)
    .eq("birth_date", input.birthDate)
    .eq("phone", input.phone)
    .not("claimed_user_id", "is", null)
    .limit(1)
    .maybeSingle();
  if (error) throw Errors.internal(error.message);
  return data?.claimed_user_id ?? null;
}

// 다른 클리닉에서 이미 가입된 계정과 "등록 즉시" 자동 연결된 행인지 판별해, 그런 경우에만
// claimed_user_id/claimed_at을 응답에서 숨긴다 — 이 클리닉 관리자에게 "이 환자가 다른 클리닉에도
// 다닌다"는 사실이 노출되지 않게 하기 위함(사용자 요청). 이 클리닉 자체 patientNo로 정상 회원가입한
// 경우는(보통 등록일과 가입일 시각이 다름) 그대로 노출한다 — "가입 여부"는 그 클리닉 입장에선 유의미한
// 정보라 명세서에도 문서화돼 있다. 신규 컬럼 없이 구분하기 위해, createPatient가 자동 연결 시
// created_at/claimed_at을 동일한 값으로 명시적으로 채워두고 여기서 그 둘이 정확히 같은지로 판별한다.
function maskAutoLinkedClaim<
  T extends { claimed_user_id: string | null; claimed_at: string | null; created_at: string },
>(patient: T): T {
  if (patient.claimed_user_id && patient.claimed_at === patient.created_at) {
    return { ...patient, claimed_user_id: null, claimed_at: null };
  }
  return patient;
}

// SMS 발송 연동 전 임시 스텁 — 2026-08-11 Tier 1에서 SMS 인프라를 비용 문제로 통째로 제거했었는데
// (server/README.md TODO 참고), 다른 클리닉에서 이미 가입된 고객을 자동 연결할 때 안내가 필요해져
// 다시 마주쳤다. 실제 발송 수단(SMS 업체 재연동 vs 이메일 등)은 아직 미정이라 일단 로그만 남기고
// 배선만 해둔다 — push.service.ts의 sendPushToUser와 동일한 패턴.
async function notifyExistingAccountLinked(phone: string): Promise<void> {
  // eslint-disable-next-line no-console
  console.log(
    `[notify] 다른 클리닉에서 이미 가입된 계정과 자동 연결됨 — 안내 발송 대상: ${phone} (발송 로직 미구현, 로그만 남김)`,
  );
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
    if (newNotes === existing.notes) return { patient: maskAutoLinkedClaim(existing), duplicate: true };

    const { data: updated, error: updateError } = await supabaseAdmin
      .from("emr_patients")
      .update({ notes: newNotes, updated_at: new Date().toISOString() })
      .eq("id", existing.id)
      .select()
      .single();
    if (updateError) throw Errors.internal(updateError.message);
    return { patient: maskAutoLinkedClaim(updated), duplicate: true };
  }

  // 전화번호 재사용 차단 — 이름/생년월일이 달라도 이 번호를 쓰는 환자가 이미 있으면 등록 자체를
  // 막는다. 이유: emr_patients.phone엔 unique 제약이 없어 여기선 통과되지만, 실제 회원가입 시
  // profiles.phone은 유니크라 두 사람이 나중에 각자 가입하면 두 번째 사람이 원인을 알 수 없는
  // 500으로 막힌다(auth.service.ts의 signup() catch). 미리 여기서 막아 그 사고를 예방한다.
  // 단, 이름+생년월일+전화번호가 전부 같은 행(findLinkedAccountFromOtherClinic이 다루는 "다른
  // 클리닉의 동일 인물" 자동 연결 케이스)은 제외 — 그건 충돌이 아니라 같은 사람이다.
  const { data: samePhoneRows, error: phoneCheckError } = await supabaseAdmin
    .from("emr_patients")
    .select("id, name, birth_date")
    .eq("phone", input.phone);
  if (phoneCheckError) throw Errors.internal(phoneCheckError.message);
  const hasConflict = (samePhoneRows ?? []).some(
    (r) => !(r.name === input.name && r.birth_date === input.birthDate),
  );
  if (hasConflict) throw Errors.phoneAlreadyRegistered();

  const linkedUserId = await findLinkedAccountFromOtherClinic(input, brand);
  // 자동 연결 케이스는 created_at/claimed_at을 동일한 값으로 명시적으로 채워 maskAutoLinkedClaim이
  // 정상 가입(등록일 ≠ 가입일)과 구분할 수 있게 한다.
  const linkedAt = new Date().toISOString();

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
        // 다른 클리닉에서 이미 가입된 같은 사람이면 이 행을 만드는 즉시 그 계정에 연결한다 —
        // 이 클리닉만의 독립된 차트(행)는 그대로 새로 만들되, 회원가입 절차 없이도 바로
        // 실제 앱 테이블(care_records/memberships)에 기록을 쓸 수 있게 하기 위함.
        ...(linkedUserId && { claimed_user_id: linkedUserId, claimed_at: linkedAt, created_at: linkedAt }),
      })
      .select()
      .single();

    if (!error) {
      if (linkedUserId) await notifyExistingAccountLinked(input.phone);
      // duplicate는 그대로 false — 관리자 화면에는 평소 신규 등록과 동일하게 보인다. claimed_user_id는
      // maskAutoLinkedClaim이 자동 연결인 경우에만 숨긴다(다른 클리닉에 이미 계정이 있다는 사실을
      // 이 클리닉 관리자에게 노출하지 않기 위함).
      return { patient: maskAutoLinkedClaim(data), duplicate: false };
    }
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

  return patients.map((p) => ({ ...maskAutoLinkedClaim(p), latestCareName: latestByPatient.get(p.id)?.name ?? null }));
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

  // patient.claimed_user_id는 위에서 app 쪽 데이터를 가져오는 데 실제 값 그대로 이미 사용했다 —
  // 마스킹은 응답 필드에만 적용하고, 방금 조회한 careRecords/memberships(자동 연결이어도 실제
  // 시술기록은 정상적으로 다 보여줘야 함)에는 영향 없다.
  return { patient: maskAutoLinkedClaim(patient), careRecords, memberships };
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
  return maskAutoLinkedClaim(data);
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
  brand: string,
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
      // 순수 표시용 메타데이터 — 이 이용권을 처음 만든 클리닉. 이어서 차감할 때(findContinuableMembership)
      // 매칭 조건엔 안 쓴다(이용권은 여전히 클리닉 간 격리되지 않음, 기존 정책 유지).
      brand,
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

// 회원가입(claim) 여부에 따라 어느 테이블에 쓸지 정한다 — claim 전이면 emr_* 스테이징,
// claim 후면 실제 앱 테이블(care_records/memberships)에 곧바로 기록한다. 예전엔 claim된 환자에
// 새 시술기록 자체를 막았지만(1회성 이관), 재방문 고객의 시술을 기록할 방법이 없어지는 문제가 있어
// 이제는 claim 여부와 무관하게 항상 기록 가능하도록 바꿨다.
export async function addCareRecord(
  patientId: string,
  input: {
    careName: string;
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
          brand,
        );
      })();

  const insertPayload: Record<string, unknown> = {
    [ownerColumn]: ownerId,
    care_name: input.careName,
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

  // 회원가입(claim) 후에만 존재하는 이용권 회차별 사용 이력(GET /memberships의 usageHistory) —
  // membership_usages.membership_id가 memberships(앱 테이블) FK라 claim 전(emr_memberships)엔 대상 없음.
  if (claimed) {
    const { error: usageError } = await supabaseAdmin
      .from("membership_usages")
      .upsert(
        {
          membership_id: membership.id,
          care_record_id: data.id,
          session_number: membership.used_count,
          used_at: input.careDate,
        },
        { onConflict: "membership_id,session_number" },
      );
    if (usageError) throw Errors.internal(usageError.message);
  }

  // 예약(미래 careDate) 등록 즉시 알림. 오늘 날짜 시술(0일차)은 등록 직후가 아니라 그날 저녁
  // 알림으로 별도 처리한다(server/의 일일 크론, "시술 등록하자마자 축하 알림"은 어색해서 제외) —
  // 과거 날짜로 소급 등록하는 경우(백필)도 대상 아님. 알림 발송 실패가 시술 등록 자체를
  // 실패시키면 안 되므로 별도로 감싼다.
  if (claimed && input.careDate > kstDateString(0)) {
    const notification = {
      title: "WHS After Mate",
      body: `${input.careDate} ${input.careName} 예약이 등록되었습니다.`,
    };
    try {
      await sendCareRegisteredPush(ownerId, notification);
      await supabaseAdmin.from("notification_log").upsert(
        { user_id: ownerId, type: "care_registered", ref_id: data.id, ref_key: "registered" },
        { onConflict: "type,ref_id,ref_key", ignoreDuplicates: true },
      );
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[addCareRecord] 예약 알림 발송 실패:", err);
    }
  }

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

  // membership_usages.care_record_id는 on delete set null이라 care_record 삭제만으로는 이 행이
  // 안 지워짐 — 그대로 두면 같은 session_number를 나중에 재사용할 때 unique 제약에 걸린다.
  await supabaseAdmin.from("membership_usages").delete().eq("care_record_id", careRecordId);

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

// KST 자정 기준 하루 범위를 UTC ISO 문자열로 변환 — emr_patients.created_at(timestamptz) 범위
// 쿼리용. "YYYY-MM-DDT00:00:00+09:00"으로 명시적 오프셋을 주면 서버가 어느 시간대에서 돌아가든
// 정확히 그 KST 날짜의 자정을 가리키는 시각이 나온다.
function kstDayRangeUtc(dateStr: string): { startUtc: string; endUtc: string } {
  const start = new Date(`${dateStr}T00:00:00+09:00`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { startUtc: start.toISOString(), endUtc: end.toISOString() };
}

// 2026-08-18 변경 — 전날/금일: "방문(시술기록 있음)" 대신 "신규 등록(환자번호 최초 발급)" 인원 수로
// 교체(사용자 요청). emr_patients.created_at은 그 환자 행이 처음 만들어진 시각과 정확히 같다 —
// POST /patients가 이름+생년월일+전화번호 일치 시 기존 환자를 재사용하고 새로 만들지 않으므로,
// 재방문객·기존 환자는 여기 안 잡히고 "정말 처음 등록한 사람"만 그 날짜로 카운트된다.
// 익일: 여전히 "예약"(미래 careDate로 등록된 시술기록) 고객 수 — 등록일이 아니라 시술 예정일 기준이라
// 신규 등록 개념을 그대로 적용할 수 없어(미래에 "등록"이라는 게 없음) 기존 방식을 유지한다.
export async function getVisitStats(brand: string) {
  const days = [
    { key: "yesterday", date: kstDateString(1) },
    { key: "today", date: kstDateString(0) },
    { key: "tomorrow", date: kstDateString(-1) },
  ] as const;

  const { startUtc } = kstDayRangeUtc(days[0].date); // 전날 00:00 KST
  const { endUtc } = kstDayRangeUtc(days[1].date); // 금일 24:00 KST(=금일 끝)
  const { data: newPatientRows, error: newPatientError } = await supabaseAdmin
    .from("emr_patients")
    .select("created_at")
    .eq("brand", brand)
    .gte("created_at", startUtc)
    .lt("created_at", endUtc);
  if (newPatientError) throw Errors.internal(newPatientError.message);

  const newRegistrationCounts = { yesterday: 0, today: 0 };
  for (const row of newPatientRows ?? []) {
    const kstDate = new Date(row.created_at).toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
    if (kstDate === days[0].date) newRegistrationCounts.yesterday++;
    else if (kstDate === days[1].date) newRegistrationCounts.today++;
  }

  const tomorrowDate = days[2].date;
  const [{ data: emrRows, error: emrError }, { data: appRows, error: appError }] = await Promise.all([
    supabaseAdmin
      .from("emr_care_records")
      .select("patient_id, care_date, patient:emr_patients(claimed_user_id)")
      .eq("brand", brand)
      .eq("care_date", tomorrowDate)
      .returns<{ patient_id: string; care_date: string; patient: { claimed_user_id: string | null } | null }[]>(),
    supabaseAdmin.from("care_records").select("user_id, care_date").eq("brand", brand).eq("care_date", tomorrowDate),
  ]);
  if (emrError) throw Errors.internal(emrError.message);
  if (appError) throw Errors.internal(appError.message);

  // 주의: 환자가 "당일 방문 기록(emr) → 당일 회원가입" 순서를 밟으면, claim 시 그 방문 기록이
  // care_records로 1회성 복사되기 때문에(server/의 signup()) 같은 사람의 같은 방문이 emr_care_records와
  // care_records 양쪽에 동시에 남을 수 있다 — emr_patients.claimed_user_id로 "이미 가입한 환자"를
  // user_id 기준으로 환산해서 두 집합을 하나의 identity Set으로 합친 뒤 크기를 센다.
  const tomorrowIdentities = new Set<string>();
  for (const row of emrRows ?? []) {
    tomorrowIdentities.add(row.patient?.claimed_user_id ?? row.patient_id);
  }
  for (const row of appRows ?? []) tomorrowIdentities.add(row.user_id);

  return {
    yesterday: { date: days[0].date, count: newRegistrationCounts.yesterday },
    today: { date: days[1].date, count: newRegistrationCounts.today },
    tomorrow: { date: tomorrowDate, count: tomorrowIdentities.size },
  };
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
