import { supabaseAdmin } from "../config/supabase";
import { Errors } from "../lib/errors";

export interface CareRecordRow {
  id: string;
  care_name: string;
  care_date: string;
  part_of_body: string[];
  brand: string | null;
  practitioner: string | null;
  status: string;
  basic_aftercare_guide: string[];
  doctor_comment: string | null;
  session_number?: number | null;
  total_sessions?: number | null;
  membership?: { id: string; product_name: string; total_count: number } | null;
}

const LIST_COLUMNS =
  "id, care_name, care_date, part_of_body, brand, practitioner, status, basic_aftercare_guide, doctor_comment";

// 상세 화면 전용 — 회차·연결 이용권까지 조회 (v0.5). memberships FK(membership_id)로 상품명을 조인한다.
const DETAIL_COLUMNS = `${LIST_COLUMNS}, session_number, total_sessions, membership:memberships(id, product_name, total_count)`;

export function toCareRecordSummary(row: CareRecordRow) {
  return {
    careRecordId: row.id,
    careName: row.care_name,
    careDate: row.care_date,
    partOfBody: row.part_of_body,
    brand: row.brand,
    practitioner: row.practitioner,
    status: row.status,
  };
}

// 관리 상세 화면 응답 — "결과일/관리 회차/이용권" 확장 필드 포함 (v0.5)
export function toCareRecordDetail(row: CareRecordRow) {
  return {
    ...toCareRecordSummary(row),
    daysElapsed: daysElapsedSince(row.care_date),
    session:
      row.session_number != null && row.total_sessions != null
        ? { number: row.session_number, total: row.total_sessions }
        : null,
    membership: row.membership
      ? {
          membershipId: row.membership.id,
          productName: row.membership.product_name,
          totalCount: row.membership.total_count,
        }
      : null,
    basicAftercareGuide: row.basic_aftercare_guide,
  };
}

// KST(한국 시간) 기준 오늘 날짜. "가장 최근 관리"는 예약(미래 careDate)을 후보에서 빼야 한다 —
// server_admin이 예약 등록을 허용하면서(차감 없이 careDate만 미래로 등록 가능) "최근 관리"를
// 단순히 care_date 내림차순으로만 고르면 아직 받지도 않은 미래 예약이 뽑혀버린다. 그 결과
// daily-guide/questions(챗봇)의 "경과일" 계산이 엉망이 되고(예: 미래 예약을 기준으로 삼아 0일차로
// 계산돼 "오늘이 시술 당일"처럼 잘못 안내), 다음 관리 추천의 "마지막 관리 후 경과일" 판단도 틀어진다.
function kstToday(): string {
  const now = new Date();
  return new Date(now.toLocaleString("en-US", { timeZone: "Asia/Seoul" })).toLocaleDateString("en-CA");
}

export async function getLatestCareRecord(userId: string): Promise<CareRecordRow | null> {
  const { data, error } = await supabaseAdmin
    .from("care_records")
    .select(LIST_COLUMNS)
    .eq("user_id", userId)
    .lte("care_date", kstToday())
    .order("care_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw Errors.internal("최근 관리 이력 조회에 실패했습니다.");
  return data as CareRecordRow | null;
}

export async function getCareRecordById(userId: string, careRecordId: string): Promise<CareRecordRow> {
  const { data, error } = await supabaseAdmin
    .from("care_records")
    .select(DETAIL_COLUMNS)
    .eq("user_id", userId)
    .eq("id", careRecordId)
    .maybeSingle();

  if (error || !data) throw Errors.careRecordNotFound();
  return data as unknown as CareRecordRow;
}

// "최근 관리와 함께 확인해보세요" 등에 쓰이는 다건 최근 이력 조회 (추천 상세, v0.5)
export async function listRecentCareRecords(
  userId: string,
  limit: number,
  excludeCareRecordId?: string,
): Promise<CareRecordRow[]> {
  let query = supabaseAdmin
    .from("care_records")
    .select(LIST_COLUMNS)
    .eq("user_id", userId)
    .lte("care_date", kstToday())
    .order("care_date", { ascending: false })
    .limit(limit);

  if (excludeCareRecordId) query = query.neq("id", excludeCareRecordId);

  const { data, error } = await query;
  if (error) throw Errors.internal("최근 관리 이력 조회에 실패했습니다.");
  return data as CareRecordRow[];
}

export async function listCareRecords(
  userId: string,
  params: { page: number; size: number; dateFrom?: string; dateTo?: string; partOfBody?: string; brand?: string },
) {
  let query = supabaseAdmin
    .from("care_records")
    .select(LIST_COLUMNS, { count: "exact" })
    .eq("user_id", userId)
    .order("care_date", { ascending: false });

  if (params.dateFrom) query = query.gte("care_date", params.dateFrom);
  if (params.dateTo) query = query.lte("care_date", params.dateTo);
  if (params.partOfBody) query = query.contains("part_of_body", [params.partOfBody]);
  if (params.brand) query = query.eq("brand", params.brand);

  const from = (params.page - 1) * params.size;
  const to = from + params.size - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;
  if (error) throw Errors.internal("관리 이력 조회에 실패했습니다.");

  return {
    items: (data as CareRecordRow[]).map(toCareRecordSummary),
    page: params.page,
    size: params.size,
    totalCount: count ?? 0,
  };
}

export async function getCalendarSummary(userId: string, month: string) {
  const [year, monthNum] = month.split("-").map(Number);
  const dateFrom = `${month}-01`;
  const nextMonth = monthNum === 12 ? `${year + 1}-01-01` : `${year}-${String(monthNum + 1).padStart(2, "0")}-01`;

  const { data, error } = await supabaseAdmin
    .from("care_records")
    .select("care_date")
    .eq("user_id", userId)
    .gte("care_date", dateFrom)
    .lt("care_date", nextMonth);

  if (error) throw Errors.internal("캘린더 조회에 실패했습니다.");

  const counts = new Map<string, number>();
  for (const row of data as { care_date: string }[]) {
    counts.set(row.care_date, (counts.get(row.care_date) ?? 0) + 1);
  }

  const dates = [...counts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));

  return { month, dates };
}

export function daysElapsedSince(careDate: string): number {
  const care = new Date(`${careDate}T00:00:00+09:00`);
  const now = new Date();
  const nowKst = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  const diffMs = nowKst.setHours(0, 0, 0, 0) - care.setHours(0, 0, 0, 0);
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}
