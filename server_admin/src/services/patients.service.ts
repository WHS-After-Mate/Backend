import { randomBytes, randomInt } from "node:crypto";
import { supabaseAdmin } from "../config/supabase";
import { Errors } from "../lib/errors";

const SIGNUP_CODE_VALID_HOURS = 24;

function generatePatientNo() {
  // EMR-P-XXXXXX (병원 차트번호 느낌의 사람이 읽기 쉬운 형태). 충돌 시 호출부에서 재시도한다.
  return `EMR-P-${randomBytes(3).toString("hex").toUpperCase()}`;
}

function generateSignupCode() {
  // 6자리 숫자 코드. 실제 SMS 발송은 하지 않고 admin-web 화면에 그대로 표시해 데스크에서 안내한다.
  return String(randomInt(100000, 1000000));
}

export async function createPatient(input: {
  name: string;
  birthDate: string;
  phone: string;
  allergies: string[];
  chronicConditions: string[];
  doctorGeneralComment?: string;
}) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const patientNo = generatePatientNo();
    const { data, error } = await supabaseAdmin
      .from("emr_patients")
      .insert({
        patient_no: patientNo,
        name: input.name,
        birth_date: input.birthDate,
        phone: input.phone,
        allergies: input.allergies,
        chronic_conditions: input.chronicConditions,
        doctor_general_comment: input.doctorGeneralComment ?? null,
      })
      .select()
      .single();

    if (!error) return data;
    // 23505 = unique_violation (patient_no 충돌) — 새 번호로 재시도
    if (error.code !== "23505") throw Errors.internal(error.message);
  }
  throw Errors.internal("환자번호 발급에 실패했습니다. 다시 시도해주세요.");
}

export async function listPatients(search?: string) {
  let query = supabaseAdmin
    .from("emr_patients")
    .select("id, patient_no, name, birth_date, phone, claimed_user_id, claimed_at, created_at")
    .order("created_at", { ascending: false });

  if (search) {
    query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%,patient_no.ilike.%${search}%`);
  }

  const { data, error } = await query;
  if (error) throw Errors.internal(error.message);
  return data;
}

async function findPatientOrThrow(patientId: string) {
  const { data, error } = await supabaseAdmin.from("emr_patients").select("*").eq("id", patientId).maybeSingle();
  if (error) throw Errors.internal(error.message);
  if (!data) throw Errors.patientNotFound();
  return data;
}

export async function getPatient(patientId: string) {
  const patient = await findPatientOrThrow(patientId);

  const [{ data: careRecords }, { data: memberships }, { data: signupCodes }] = await Promise.all([
    supabaseAdmin
      .from("emr_care_records")
      .select("*")
      .eq("patient_id", patientId)
      .order("care_date", { ascending: false }),
    supabaseAdmin.from("emr_memberships").select("*").eq("patient_id", patientId).order("created_at", { ascending: false }),
    supabaseAdmin
      .from("signup_verification_codes")
      .select("id, code, expires_at, used_at, created_at")
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false }),
  ]);

  return { patient, careRecords: careRecords ?? [], memberships: memberships ?? [], signupCodes: signupCodes ?? [] };
}

export async function updatePatient(
  patientId: string,
  input: Partial<{
    name: string;
    birthDate: string;
    phone: string;
    allergies: string[];
    chronicConditions: string[];
    doctorGeneralComment: string;
  }>,
) {
  await findPatientOrThrow(patientId);

  const { data, error } = await supabaseAdmin
    .from("emr_patients")
    .update({
      ...(input.name !== undefined && { name: input.name }),
      ...(input.birthDate !== undefined && { birth_date: input.birthDate }),
      ...(input.phone !== undefined && { phone: input.phone }),
      ...(input.allergies !== undefined && { allergies: input.allergies }),
      ...(input.chronicConditions !== undefined && { chronic_conditions: input.chronicConditions }),
      ...(input.doctorGeneralComment !== undefined && { doctor_general_comment: input.doctorGeneralComment }),
      updated_at: new Date().toISOString(),
    })
    .eq("id", patientId)
    .select()
    .single();

  if (error) throw Errors.internal(error.message);
  return data;
}

// claim(회원가입) 이후의 emr_* 추가 입력은 실제 앱 DB로 동기화되지 않는다(1회성 이관만 지원 — server-code-guide 참고).
// 그래서 claim된 환자에 새 기록/이용권/인증코드를 추가하려 하면 명확히 막아 혼란을 예방한다.
async function assertNotClaimed(patientId: string) {
  const patient = await findPatientOrThrow(patientId);
  if (patient.claimed_user_id) throw Errors.patientAlreadyClaimed();
  return patient;
}

export async function addCareRecord(
  patientId: string,
  input: {
    careName: string;
    careType: string;
    careDate: string;
    partOfBody?: string;
    brand?: string;
    store?: string;
    practitioner?: string;
    basicAftercareGuide: string[];
    doctorComment?: string;
    sessionNumber?: number;
    totalSessions?: number;
  },
) {
  await assertNotClaimed(patientId);

  const { data, error } = await supabaseAdmin
    .from("emr_care_records")
    .insert({
      patient_id: patientId,
      care_name: input.careName,
      care_type: input.careType,
      care_date: input.careDate,
      part_of_body: input.partOfBody ?? null,
      brand: input.brand ?? null,
      store: input.store ?? null,
      practitioner: input.practitioner ?? null,
      basic_aftercare_guide: input.basicAftercareGuide,
      doctor_comment: input.doctorComment ?? null,
      session_number: input.sessionNumber ?? null,
      total_sessions: input.totalSessions ?? null,
    })
    .select()
    .single();

  if (error) throw Errors.internal(error.message);
  return data;
}

export async function deleteCareRecord(careRecordId: string) {
  const { data, error } = await supabaseAdmin.from("emr_care_records").delete().eq("id", careRecordId).select().maybeSingle();
  if (error) throw Errors.internal(error.message);
  if (!data) throw Errors.careRecordNotFound();
}

export async function addMembership(
  patientId: string,
  input: {
    productName: string;
    totalCount: number;
    usedCount: number;
    expiresAt?: string;
    lastUsedAt?: string;
    availableCareNames: string[];
  },
) {
  await assertNotClaimed(patientId);

  const { data, error } = await supabaseAdmin
    .from("emr_memberships")
    .insert({
      patient_id: patientId,
      product_name: input.productName,
      total_count: input.totalCount,
      used_count: input.usedCount,
      expires_at: input.expiresAt ?? null,
      last_used_at: input.lastUsedAt ?? null,
      available_care_names: input.availableCareNames,
    })
    .select()
    .single();

  if (error) throw Errors.internal(error.message);
  return data;
}

export async function deleteMembership(membershipId: string) {
  const { data, error } = await supabaseAdmin.from("emr_memberships").delete().eq("id", membershipId).select().maybeSingle();
  if (error) throw Errors.internal(error.message);
  if (!data) throw Errors.membershipNotFound();
}

export async function issueSignupCode(patientId: string) {
  await assertNotClaimed(patientId);

  const code = generateSignupCode();
  const expiresAt = new Date(Date.now() + SIGNUP_CODE_VALID_HOURS * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabaseAdmin
    .from("signup_verification_codes")
    .insert({ patient_id: patientId, code, expires_at: expiresAt })
    .select("id, code, expires_at, created_at")
    .single();

  if (error) throw Errors.internal(error.message);
  return data;
}
