import { env } from "../config/env";
import { supabaseAdmin, supabaseAnon } from "../config/supabase";
import { ApiError, Errors } from "../lib/errors";

// 회원가입 1~2단계(pre-check/signup) 공통 — 환자번호(patientNo)+이름+생년월일+전화번호 네 값이
// emr_patients 레코드와 정확히 일치하는지로 신원을 확인한다. 일치하지 않으면 throw, 일치하면
// 그 emr_patients 행을 반환(signup()이 claim 처리에 그대로 재사용).
async function checkPatientIdentity(input: { patientNo: string; name: string; birthDate: string; phone: string }) {
  const { data: patient } = await supabaseAdmin
    .from("emr_patients")
    .select("id, name, birth_date, phone, notes, claimed_user_id")
    .eq("patient_no", input.patientNo)
    .maybeSingle();
  if (!patient) throw Errors.patientNotFound();
  if (patient.claimed_user_id) throw Errors.patientAlreadyClaimed();

  if (
    patient.name.trim() !== input.name.trim() ||
    patient.birth_date !== input.birthDate ||
    patient.phone !== input.phone
  ) {
    throw Errors.patientIdentityMismatch();
  }

  return patient;
}

// 회원가입 1단계(2페이지 분리, 프론트 요청) — 계정을 만들지 않고 신원 일치 여부만 먼저 확인한다.
// 실패 시 signup()과 동일한 에러 코드(404/409/400)를 던지므로 프론트가 두 단계에서 같은 에러
// 처리 로직을 재사용할 수 있다. 부수효과 없음(emr_patients 조회만, claim 안 함).
export async function preCheckSignup(input: {
  patientNo: string;
  name: string;
  birthDate: string;
  phone: string;
}): Promise<void> {
  await checkPatientIdentity(input);
}

// emr_care_records/emr_memberships를 실제 care_records/memberships로 1회성 이관한다.
// signup()이 본인 patientId뿐 아니라, 다른 클리닉에 남아있던 동일 인물의 미가입 형제 행
// (아래 signup()의 "형제 행 일괄 claim" 참고)에도 그대로 재사용한다.
async function migrateEmrDataToApp(patientId: string, userId: string) {
  // 이용권을 먼저 이관해 emr_memberships.id → 새 memberships.id 매핑을 만들어야, 아래
  // care_records.membership_id를 연결하고 membership_usages(회차별 사용일자)를 채울 수 있다.
  // 2026-08-18 이전엔 이 매핑이 없어 이관된 시술기록이 이용권과 연결되지 않았고
  // (membership_id 항상 null), GET /memberships의 usageHistory도 항상 빈 배열이었다(dd.txt 버그 신고).
  const { data: emrMemberships } = await supabaseAdmin
    .from("emr_memberships")
    .select("*")
    .eq("patient_id", patientId);

  const membershipIdMap = new Map<string, string>(); // emr_memberships.id -> memberships.id
  if (emrMemberships && emrMemberships.length > 0) {
    const { data: inserted, error: membershipsError } = await supabaseAdmin
      .from("memberships")
      .insert(
        emrMemberships.map((m) => ({
          user_id: userId,
          product_name: m.product_name,
          total_count: m.total_count,
          used_count: m.used_count,
          expires_at: m.expires_at,
          last_used_at: m.last_used_at,
          available_care_names: m.available_care_names,
          brand: m.brand,
        })),
      )
      .select("id");
    if (membershipsError) throw membershipsError;
    emrMemberships.forEach((m, i) => membershipIdMap.set(m.id, inserted![i].id));
  }

  const { data: emrCareRecords } = await supabaseAdmin
    .from("emr_care_records")
    .select("*")
    .eq("patient_id", patientId);
  if (emrCareRecords && emrCareRecords.length > 0) {
    const { data: insertedCareRecords, error: careRecordsError } = await supabaseAdmin
      .from("care_records")
      .insert(
        emrCareRecords.map((r) => ({
          user_id: userId,
          care_name: r.care_name,
          care_type: r.care_type,
          care_date: r.care_date,
          part_of_body: r.part_of_body,
          brand: r.brand,
          practitioner: r.practitioner,
          basic_aftercare_guide: r.basic_aftercare_guide,
          doctor_comment: r.doctor_comment,
          session_number: r.session_number,
          total_sessions: r.total_sessions,
          membership_id: r.membership_id ? (membershipIdMap.get(r.membership_id) ?? null) : null,
          source_system: "aac_emr",
          synced_at: new Date().toISOString(),
        })),
      )
      .select("id, membership_id, session_number, care_date");
    if (careRecordsError) throw careRecordsError;

    const usageRows = (insertedCareRecords ?? [])
      .filter((r) => r.membership_id != null && r.session_number != null)
      .map((r) => ({
        membership_id: r.membership_id as string,
        care_record_id: r.id,
        session_number: r.session_number as number,
        used_at: r.care_date,
      }));
    if (usageRows.length > 0) {
      const { error: usageError } = await supabaseAdmin
        .from("membership_usages")
        .upsert(usageRows, { onConflict: "membership_id,session_number" });
      if (usageError) throw usageError;
    }
  }
}

// 회원가입 2단계 = "병원에서 이미 시술받은 환자가 앱 계정을 처음 만드는 순간"이다.
// 신원 확인(checkPatientIdentity) 후, 그 시점까지 쌓여있던 emr_care_records/emr_memberships를
// 실제 테이블로 1회성 이관(claim)한다.
export async function signup(input: {
  patientNo: string;
  name: string;
  birthDate: string;
  phone: string;
  email: string;
  password: string;
  interestGoals: string[];
}) {
  const patient = await checkPatientIdentity(input);

  const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
  });

  if (createError || !created.user) {
    if (createError?.message?.toLowerCase().includes("already")) throw Errors.emailAlreadyExists();
    throw Errors.internal(createError?.message ?? "회원가입에 실패했습니다.");
  }
  const userId = created.user.id;

  // 아래 단계 중 하나라도 실패하면 방금 만든 Auth 유저를 롤백(deleteUser)한다.
  // profiles/medical_profiles/care_records/memberships는 전부 auth.users에 CASCADE로 걸려있어
  // 유저 삭제 시 함께 정리되므로, emr_patients는 claim 처리 전이라 그대로 남아 재시도 가능하다.
  try {
    const { error: profileError } = await supabaseAdmin.from("profiles").insert({
      user_id: userId,
      name: patient.name,
      phone: patient.phone,
      birth_date: patient.birth_date,
      interest_goals: input.interestGoals,
    });
    if (profileError) throw profileError;

    // emr_patients.notes(기타사항, 알러지/기저질환/의사소견 통합 자유입력)를 그대로
    // doctor_general_comment에 옮긴다 — allergies/chronic_conditions는 더 이상 구조화 입력을
    // 받지 않아 빈 배열로 둔다. daily-guide/questions LLM 프롬프트는 doctor_general_comment도
    // 컨텍스트로 읽으므로 알러지 등 안전 관련 정보는 여전히 전달된다.
    const { error: medicalProfileError } = await supabaseAdmin.from("medical_profiles").insert({
      user_id: userId,
      external_patient_id: input.patientNo,
      allergies: [],
      chronic_conditions: [],
      doctor_general_comment: patient.notes,
      source_system: "aac_emr",
      synced_at: new Date().toISOString(),
    });
    if (medicalProfileError) throw medicalProfileError;

    await migrateEmrDataToApp(patient.id, userId);

    // 다른 클리닉(브랜드)에 남아있는 "같은 사람"의 미가입 형제 행도 한꺼번에 이 계정으로
    // claim한다 — 어느 클리닉 patientNo로 먼저 회원가입하든, 결과적으로 계정이 하나로
    // 합쳐지게 하기 위함. 형제 행이 없으면(다른 클리닉 방문 이력이 없으면) 그냥 빈 배열.
    const { data: siblings, error: siblingsError } = await supabaseAdmin
      .from("emr_patients")
      .select("id")
      .neq("id", patient.id)
      .is("claimed_user_id", null)
      .eq("name", input.name)
      .eq("birth_date", input.birthDate)
      .eq("phone", input.phone);
    if (siblingsError) throw siblingsError;

    for (const sibling of siblings ?? []) {
      await migrateEmrDataToApp(sibling.id, userId);
      const { error: siblingClaimError } = await supabaseAdmin
        .from("emr_patients")
        .update({ claimed_user_id: userId, claimed_at: new Date().toISOString() })
        .eq("id", sibling.id);
      if (siblingClaimError) throw siblingClaimError;
    }

    await supabaseAdmin
      .from("emr_patients")
      .update({ claimed_user_id: userId, claimed_at: new Date().toISOString() })
      .eq("id", patient.id);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[signup] 의료기록 이관 실패:", err);
    await supabaseAdmin.auth.admin.deleteUser(userId);
    throw Errors.internal("가입 처리 중 의료기록 이관에 실패했습니다.");
  }

  return login({ email: input.email, password: input.password });
}

export async function login(input: { email: string; password: string }) {
  const { data, error } = await supabaseAnon.auth.signInWithPassword(input);
  if (error || !data.session) throw Errors.invalidCredentials();

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("name")
    .eq("user_id", data.user.id)
    .maybeSingle();

  return {
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
    expiresIn: data.session.expires_in,
    user: { id: data.user.id, name: profile?.name ?? "", role: "customer" as const },
  };
}

export async function refreshAccessToken(refreshToken: string) {
  const { data, error } = await supabaseAnon.auth.refreshSession({ refresh_token: refreshToken });
  if (error || !data.session) throw Errors.invalidRefreshToken();

  return { accessToken: data.session.access_token, expiresIn: data.session.expires_in };
}

export async function logout(accessToken: string) {
  const { error } = await supabaseAdmin.auth.admin.signOut(accessToken, "global");
  if (error) throw new ApiError(500, "INTERNAL_ERROR", "로그아웃 처리에 실패했습니다.");
}

// 로그인 화면의 "비밀번호를 잊으셨나요?" — 계정 존재 여부와 무관하게 항상 성공 처리한다
// (이메일 열거 공격 방지: Supabase도 미존재 이메일에 에러를 던지지 않고 동일하게 성공 응답한다).
// Supabase는 이 호출 한 번으로 재설정 링크와 6자리 OTP를 동시에 발급한다 — 이메일에 코드가
// 실제로 보이려면 Supabase 대시보드의 Authentication > Email Templates > Reset Password 템플릿에
// {{ .Token }}이 포함돼 있어야 한다(기본 템플릿은 링크만 보여줌 — 코드에서 바꿀 수 없는 대시보드 설정).
export async function requestPasswordReset(email: string) {
  const { error } = await supabaseAnon.auth.resetPasswordForEmail(email, {
    redirectTo: env.PASSWORD_RESET_REDIRECT_URL,
  });
  // 클라이언트 응답은 계정 존재 여부 노출 방지를 위해 항상 204로 그대로 두되,
  // 실패 원인(예: 무료 이메일 발송 rate limit)은 서버 콘솔에서 확인할 수 있게 로그만 남긴다.
  if (error) {
    // eslint-disable-next-line no-console
    console.error("[requestPasswordReset] Supabase 에러:", error.message);
  }
}

// 와이어프레임 05번(비밀번호 찾기)은 "인증번호 확인"과 "비밀번호 변경하기"를 별도 버튼으로 분리해
// 두고 있어, 코드 검증 단계를 독립 API로 뺐다. verifyOtp(type: "recovery")는 성공하면 그 코드를
// 발급한 계정에 대한 1회성 recovery 세션을 돌려주는데(코드 자체는 이 호출로 소진됨), 그 세션의
// access_token을 resetToken으로 그대로 클라이언트에 내려주고 confirmPasswordReset에서 재확인한다.
export async function verifyPasswordResetCode(email: string, code: string) {
  const { data, error } = await supabaseAnon.auth.verifyOtp({ email, token: code, type: "recovery" });
  if (error || !data.session) throw Errors.invalidOrExpiredResetToken();
  return data.session.access_token;
}

// verifyPasswordResetCode가 내려준 resetToken(recovery 세션의 access_token)을 getUser로 재확인한 뒤
// 비밀번호를 갱신한다. resetToken은 코드 검증 시점에 이미 소진된 코드를 대신하는 짧은 유효기간의
// 위임 토큰이라, 여기서 email/code를 다시 받지 않는다.
export async function confirmPasswordReset(resetToken: string, newPassword: string) {
  const { data, error } = await supabaseAnon.auth.getUser(resetToken);
  if (error || !data.user) throw Errors.invalidOrExpiredResetToken();

  const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(data.user.id, {
    password: newPassword,
  });
  if (updateError) throw Errors.invalidOrExpiredResetToken();

  // 재설정 과정에서 발급된 recovery 세션을 포함해 기존 세션 전체를 무효화(탈취된 토큰 무력화)
  await supabaseAdmin.auth.admin.signOut(resetToken, "global").catch(() => {});
}
