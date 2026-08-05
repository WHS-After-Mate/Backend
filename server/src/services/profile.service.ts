import { supabaseAdmin, supabaseAnon } from "../config/supabase";
import { Errors } from "../lib/errors";

export async function getProfile(userId: string) {
  const { data: profile, error } = await supabaseAdmin
    .from("profiles")
    .select("name, birth_date, phone, interest_goals")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !profile) throw Errors.noActiveCustomerProfile();

  const { data: userResult } = await supabaseAdmin.auth.admin.getUserById(userId);

  return {
    userId,
    name: profile.name,
    birthDate: profile.birth_date,
    email: userResult?.user?.email ?? "",
    phone: profile.phone,
    interestGoals: profile.interest_goals as string[],
  };
}

export async function updateProfile(userId: string, patch: { name?: string; birthDate?: string }) {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .update({
      ...(patch.name !== undefined && { name: patch.name }),
      ...(patch.birthDate !== undefined && { birth_date: patch.birthDate }),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .select("name, birth_date, phone, interest_goals")
    .single();

  if (error || !data) throw Errors.noActiveCustomerProfile();

  const { data: userResult } = await supabaseAdmin.auth.admin.getUserById(userId);

  return {
    userId,
    name: data.name,
    birthDate: data.birth_date,
    email: userResult?.user?.email ?? "",
    phone: data.phone,
    interestGoals: data.interest_goals as string[],
  };
}

// 내 정보 화면의 비밀번호 변경 — 현재 비밀번호를 재검증(signInWithPassword)한 뒤에만 갱신한다 (v0.5)
export async function changePassword(userId: string, currentPassword: string, newPassword: string) {
  const { data: userResult } = await supabaseAdmin.auth.admin.getUserById(userId);
  const email = userResult?.user?.email;
  if (!email) throw Errors.invalidCurrentPassword();

  const { error: verifyError } = await supabaseAnon.auth.signInWithPassword({
    email,
    password: currentPassword,
  });
  if (verifyError) throw Errors.invalidCurrentPassword();

  const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    password: newPassword,
  });
  if (updateError) throw Errors.internal("비밀번호 변경에 실패했습니다.");
}

export async function updateInterestGoals(userId: string, goals: string[]) {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .update({ interest_goals: goals, updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .select("interest_goals")
    .single();

  if (error || !data) throw Errors.noActiveCustomerProfile();
  return { interestGoals: data.interest_goals as string[] };
}
