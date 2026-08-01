import { supabaseAdmin } from "../config/supabase";
import { Errors } from "../lib/errors";

export async function getProfile(userId: string) {
  const { data: profile, error } = await supabaseAdmin
    .from("profiles")
    .select("name, interest_goals")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !profile) throw Errors.noActiveCustomerProfile();

  const { data: userResult } = await supabaseAdmin.auth.admin.getUserById(userId);

  return {
    userId,
    name: profile.name,
    email: userResult?.user?.email ?? "",
    interestGoals: profile.interest_goals as string[],
  };
}

export async function updateProfile(userId: string, patch: { name?: string }) {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .select("name, interest_goals")
    .single();

  if (error || !data) throw Errors.noActiveCustomerProfile();

  const { data: userResult } = await supabaseAdmin.auth.admin.getUserById(userId);

  return {
    userId,
    name: data.name,
    email: userResult?.user?.email ?? "",
    interestGoals: data.interest_goals as string[],
  };
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
