import { env } from "../config/env";
import { supabaseAdmin, supabaseAnon } from "../config/supabase";
import { ApiError, Errors } from "../lib/errors";

// 회원가입 = "병원에서 이미 시술받은 환자가 앱 계정을 처음 만드는 순간"이다.
// 인증코드 발송 없이 환자번호(patientNo)+이름+생년월일 세 값이 emr_patients 레코드와 정확히
// 일치하는지로 신원을 확인하고, 그 시점까지 쌓여있던 emr_care_records/emr_memberships를
// 실제 테이블로 1회성 이관(claim)한다.
export async function signup(input: {
  patientNo: string;
  name: string;
  birthDate: string;
  email: string;
  password: string;
  interestGoals: string[];
}) {
  const { data: patient } = await supabaseAdmin
    .from("emr_patients")
    .select("id, name, birth_date, phone, notes, claimed_user_id")
    .eq("patient_no", input.patientNo)
    .maybeSingle();
  if (!patient) throw Errors.patientNotFound();
  if (patient.claimed_user_id) throw Errors.patientAlreadyClaimed();

  if (patient.name.trim() !== input.name.trim() || patient.birth_date !== input.birthDate) {
    throw Errors.patientIdentityMismatch();
  }

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

    const { data: emrCareRecords } = await supabaseAdmin
      .from("emr_care_records")
      .select("*")
      .eq("patient_id", patient.id);
    if (emrCareRecords && emrCareRecords.length > 0) {
      const { error: careRecordsError } = await supabaseAdmin.from("care_records").insert(
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
          source_system: "aac_emr",
          synced_at: new Date().toISOString(),
        })),
      );
      if (careRecordsError) throw careRecordsError;
    }

    const { data: emrMemberships } = await supabaseAdmin
      .from("emr_memberships")
      .select("*")
      .eq("patient_id", patient.id);
    if (emrMemberships && emrMemberships.length > 0) {
      const { error: membershipsError } = await supabaseAdmin.from("memberships").insert(
        emrMemberships.map((m) => ({
          user_id: userId,
          product_name: m.product_name,
          total_count: m.total_count,
          used_count: m.used_count,
          expires_at: m.expires_at,
          last_used_at: m.last_used_at,
          available_care_names: m.available_care_names,
        })),
      );
      if (membershipsError) throw membershipsError;
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

// 이메일로 받은 6자리 코드를 검증하고, 그 자리에서 바로 새 비밀번호까지 설정한다(코드 확인과 비밀번호
// 설정을 별도 화면/API로 나누지 않음 — 코드가 틀리면 어차피 새 비밀번호도 반려해야 하므로 한 번에 처리).
// verifyOtp가 성공하면 Supabase가 그 코드를 발급한 계정에 대한 recovery 세션을 돌려준다.
export async function confirmPasswordReset(email: string, code: string, newPassword: string) {
  const { data, error } = await supabaseAnon.auth.verifyOtp({ email, token: code, type: "recovery" });
  if (error || !data.session || !data.user) throw Errors.invalidOrExpiredResetToken();

  const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(data.user.id, {
    password: newPassword,
  });
  if (updateError) throw Errors.invalidOrExpiredResetToken();

  // 재설정 과정에서 발급된 recovery 세션을 포함해 기존 세션 전체를 무효화(탈취된 코드 무력화)
  await supabaseAdmin.auth.admin.signOut(data.session.access_token, "global").catch(() => {});
}
