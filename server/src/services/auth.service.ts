import { env } from "../config/env";
import { supabaseAdmin, supabaseAnon } from "../config/supabase";
import { ApiError, Errors } from "../lib/errors";
import { generateOtpCode, hashOtpCode, isValidKrPhone } from "../lib/otp";
import { sendSmsCode } from "../lib/sms";
import { signToken, verifyToken } from "../lib/signedToken";

const CODE_EXPIRES_IN_SECONDS = 180;
const RESEND_COOLDOWN_SECONDS = 60;
const MAX_ATTEMPTS = 5;
const PHONE_VERIFIED_TOKEN_TTL_SECONDS = 600;

export async function requestPhoneVerification(phone: string) {
  if (!isValidKrPhone(phone)) throw Errors.invalidPhoneFormat();

  const { data: recent } = await supabaseAdmin
    .from("phone_verifications")
    .select("created_at")
    .eq("phone", phone)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (recent) {
    const elapsedMs = Date.now() - new Date(recent.created_at).getTime();
    if (elapsedMs < RESEND_COOLDOWN_SECONDS * 1000) throw Errors.tooManyRequests();
  }

  const code = generateOtpCode();
  const codeHash = hashOtpCode(code);
  const expiresAt = new Date(Date.now() + CODE_EXPIRES_IN_SECONDS * 1000).toISOString();

  const { data, error } = await supabaseAdmin
    .from("phone_verifications")
    .insert({ phone, code_hash: codeHash, expires_at: expiresAt })
    .select("id")
    .single();

  if (error || !data) throw Errors.internal("인증코드 발급에 실패했습니다.");

  await sendSmsCode(phone, code);

  return { verificationId: data.id as string, expiresIn: CODE_EXPIRES_IN_SECONDS };
}

export async function confirmPhoneVerification(verificationId: string, code: string) {
  const { data: row, error } = await supabaseAdmin
    .from("phone_verifications")
    .select("id, phone, code_hash, expires_at, attempts, verified_at")
    .eq("id", verificationId)
    .maybeSingle();

  if (error || !row) throw Errors.invalidCode();
  if (row.verified_at) throw Errors.invalidCode();
  if (row.attempts >= MAX_ATTEMPTS) throw Errors.tooManyAttempts();
  if (new Date(row.expires_at).getTime() < Date.now()) throw Errors.codeExpired();

  if (hashOtpCode(code) !== row.code_hash) {
    await supabaseAdmin
      .from("phone_verifications")
      .update({ attempts: row.attempts + 1 })
      .eq("id", verificationId);
    throw Errors.invalidCode();
  }

  await supabaseAdmin
    .from("phone_verifications")
    .update({ verified_at: new Date().toISOString() })
    .eq("id", verificationId);

  const phoneVerifiedToken = signToken(
    { verificationId, phone: row.phone },
    PHONE_VERIFIED_TOKEN_TTL_SECONDS,
  );

  return { phoneVerifiedToken, expiresIn: PHONE_VERIFIED_TOKEN_TTL_SECONDS };
}

export async function signup(input: {
  email: string;
  password: string;
  name: string;
  phone: string;
  phoneVerifiedToken: string;
}) {
  const payload = verifyToken<{ verificationId: string; phone: string }>(input.phoneVerifiedToken);
  if (!payload || payload.phone !== input.phone) throw Errors.phoneNotVerified();

  const { data: existingProfile } = await supabaseAdmin
    .from("profiles")
    .select("user_id")
    .eq("phone", input.phone)
    .maybeSingle();
  if (existingProfile) throw Errors.phoneNotVerified();

  const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
  });

  if (createError || !created.user) {
    if (createError?.message?.toLowerCase().includes("already")) throw Errors.emailAlreadyExists();
    throw Errors.internal(createError?.message ?? "회원가입에 실패했습니다.");
  }

  const { error: profileError } = await supabaseAdmin.from("profiles").insert({
    user_id: created.user.id,
    name: input.name,
    phone: input.phone,
    phone_verified_at: new Date().toISOString(),
  });

  if (profileError) {
    await supabaseAdmin.auth.admin.deleteUser(created.user.id);
    throw Errors.internal("프로필 생성에 실패했습니다.");
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
// (이메일 열거 공격 방지: Supabase도 미존재 이메일에 에러를 던지지 않고 동일하게 성공 응답한다)
export async function requestPasswordReset(email: string) {
  await supabaseAnon.auth.resetPasswordForEmail(email, {
    redirectTo: env.PASSWORD_RESET_REDIRECT_URL,
  });
}

// 재설정 이메일 링크에서 추출한 토큰(token_hash)으로 새 비밀번호 설정.
// Supabase의 recovery OTP 검증 흐름: verifyOtp로 임시 세션을 얻은 뒤 admin API로 비밀번호를 갱신한다.
export async function confirmPasswordReset(recoveryToken: string, newPassword: string) {
  const { data, error } = await supabaseAnon.auth.verifyOtp({
    token_hash: recoveryToken,
    type: "recovery",
  });
  if (error || !data.session || !data.user) throw Errors.invalidOrExpiredResetToken();

  const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(data.user.id, {
    password: newPassword,
  });
  if (updateError) throw Errors.invalidOrExpiredResetToken();

  // 재설정 과정에서 발급된 임시 세션을 포함해 기존 세션 전체를 무효화(탈취된 토큰 무력화)
  await supabaseAdmin.auth.admin.signOut(data.session.access_token, "global").catch(() => {});
}
