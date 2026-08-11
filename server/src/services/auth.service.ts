import { env } from "../config/env";
import { supabaseAdmin, supabaseAnon } from "../config/supabase";
import { ApiError, Errors } from "../lib/errors";

export async function signup(input: {
  email: string;
  password: string;
  name: string;
  phone: string;
  birthDate: string;
}) {
  const { data: existingProfile } = await supabaseAdmin
    .from("profiles")
    .select("user_id")
    .eq("phone", input.phone)
    .maybeSingle();
  if (existingProfile) throw Errors.phoneAlreadyExists();

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
    birth_date: input.birthDate,
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

// 재설정 이메일 링크에서 추출한 토큰으로 새 비밀번호 설정.
// Supabase 기본 "Reset Password" 메일 템플릿은 자체 /auth/v1/verify 엔드포인트에서 먼저 검증을 마친 뒤
// redirectTo 주소의 해시(#)에 access_token/refresh_token(이미 발급된 recovery 세션)을 실어 보낸다
// (커스텀 템플릿으로 바꿔 우리가 직접 token_hash를 받는 방식이 아님 — 실사용 링크로 실측 확인함).
// 그래서 recoveryToken은 "검증 전 원본 코드"가 아니라 "이미 검증된 access_token"이고,
// getUser(jwt)로 그 토큰이 진짜 Supabase가 발급한 유효한 토큰인지만 확인하면 된다.
export async function confirmPasswordReset(recoveryToken: string, newPassword: string) {
  const { data, error } = await supabaseAnon.auth.getUser(recoveryToken);
  if (error || !data.user) throw Errors.invalidOrExpiredResetToken();

  const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(data.user.id, {
    password: newPassword,
  });
  if (updateError) throw Errors.invalidOrExpiredResetToken();

  // 재설정 과정에서 발급된 recovery 세션을 포함해 기존 세션 전체를 무효화(탈취된 토큰 무력화)
  await supabaseAdmin.auth.admin.signOut(recoveryToken, "global").catch(() => {});
}
