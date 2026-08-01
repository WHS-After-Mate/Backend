import { supabaseAdmin } from "../config/supabase";
import { Errors } from "../lib/errors";

interface MembershipRow {
  id: string;
  product_name: string;
  total_count: number;
  used_count: number;
  remaining_count: number;
  expires_at: string | null;
  last_used_at: string | null;
  available_care_names: string[];
}

function toMembershipDto(row: MembershipRow) {
  return {
    membershipId: row.id,
    productName: row.product_name,
    totalCount: row.total_count,
    usedCount: row.used_count,
    remainingCount: row.remaining_count,
    expiresAt: row.expires_at,
    lastUsedAt: row.last_used_at,
    availableCareNames: row.available_care_names,
  };
}

export async function listMemberships(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("memberships")
    .select("id, product_name, total_count, used_count, remaining_count, expires_at, last_used_at, available_care_names")
    .eq("user_id", userId)
    .order("expires_at", { ascending: true });

  if (error) throw Errors.internal("이용권 조회에 실패했습니다.");
  return { items: (data as MembershipRow[]).map(toMembershipDto) };
}

export async function getMembershipById(userId: string, membershipId: string) {
  const { data, error } = await supabaseAdmin
    .from("memberships")
    .select("id, product_name, total_count, used_count, remaining_count, expires_at, last_used_at, available_care_names")
    .eq("user_id", userId)
    .eq("id", membershipId)
    .maybeSingle();

  if (error || !data) throw Errors.membershipNotFound();
  return toMembershipDto(data as MembershipRow);
}

export async function getNearestExpiringMembership(userId: string) {
  const { data } = await supabaseAdmin
    .from("memberships")
    .select("id, expires_at, remaining_count")
    .eq("user_id", userId)
    .gt("remaining_count", 0)
    .not("expires_at", "is", null)
    .order("expires_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  return data as { id: string; expires_at: string; remaining_count: number } | null;
}

export async function countMemberships(userId: string) {
  const { count } = await supabaseAdmin
    .from("memberships")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  return count ?? 0;
}
