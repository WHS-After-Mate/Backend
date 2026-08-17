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
  brand: string | null;
  membership_usages: { session_number: number; used_at: string }[];
}

const MEMBERSHIP_COLUMNS =
  "id, product_name, total_count, used_count, remaining_count, expires_at, last_used_at, available_care_names, brand, membership_usages(session_number, used_at)";

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
    // 이 이용권을 처음 만든 클리닉 — 여러 클리닉을 다니는 고객이 이용권이 어디 것인지 구분할 때 씀.
    // 표시용일 뿐, 차감/자동 이어쓰기는 여전히 클리닉과 무관하게 처리된다(server_admin 쪽 정책).
    brand: row.brand,
    // 회차별 사용일자 — 1회차 2026.01.01 형태로 My Care·이용권 화면에 표시 (v0.5)
    usageHistory: (row.membership_usages ?? [])
      .slice()
      .sort((a, b) => a.session_number - b.session_number)
      .map((u) => ({ sessionNumber: u.session_number, usedAt: u.used_at })),
  };
}

export async function listMemberships(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("memberships")
    .select(MEMBERSHIP_COLUMNS)
    .eq("user_id", userId)
    .order("expires_at", { ascending: true });

  if (error) throw Errors.internal("이용권 조회에 실패했습니다.");
  return { items: (data as unknown as MembershipRow[]).map(toMembershipDto) };
}

export async function getMembershipById(userId: string, membershipId: string) {
  const { data, error } = await supabaseAdmin
    .from("memberships")
    .select(MEMBERSHIP_COLUMNS)
    .eq("user_id", userId)
    .eq("id", membershipId)
    .maybeSingle();

  if (error || !data) throw Errors.membershipNotFound();
  return toMembershipDto(data as unknown as MembershipRow);
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
