import { schedule } from "node-cron";
import { supabaseAdmin } from "../config/supabase";
import { sendPushToUser } from "./push.service";

// server_admin/의 kstDateString과 동일한 패턴(음수를 넣으면 미래 날짜) — 이쪽은 daysOffset이라는
// 이름으로 부호를 그대로 유지한다: 양수=과거, 음수=미래.
function kstDateString(daysOffset: number): string {
  const now = new Date();
  const kstNow = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  kstNow.setDate(kstNow.getDate() - daysOffset);
  return kstNow.toLocaleDateString("en-CA");
}

// notification_log에 먼저 claim(insert)을 시도해, 성공한 경우에만 실제로 보낸다 — "보내고 나서
// 기록"이 아니라 "기록에 성공한 것만 보낸다" 순서라 크론이 겹쳐 돌아도 중복 발송되지 않는다.
async function claimNotification(userId: string, type: string, refId: string, refKey: string): Promise<boolean> {
  const { error } = await supabaseAdmin
    .from("notification_log")
    .insert({ user_id: userId, type, ref_id: refId, ref_key: refKey });
  if (!error) return true;
  if (error.code === "23505") return false; // 이미 보낸 알림(unique 제약 충돌)
  // eslint-disable-next-line no-console
  console.error(`[notificationScheduler] ${type} 로그 기록 실패:`, error);
  return false;
}

const DAY_MILESTONES = [1, 3, 5, 7, 14];

// 매일 09:00 KST — "OO 관리 N일째예요" (1/3/5/7/14일차)
export async function runDayMilestoneCheck() {
  for (const day of DAY_MILESTONES) {
    const targetDate = kstDateString(day);
    const { data, error } = await supabaseAdmin
      .from("care_records")
      .select("id, user_id, care_name")
      .eq("care_date", targetDate);
    if (error) {
      // eslint-disable-next-line no-console
      console.error("[notificationScheduler] day-milestone 조회 실패:", error);
      continue;
    }
    for (const row of (data ?? []) as { id: string; user_id: string; care_name: string }[]) {
      const claimed = await claimNotification(row.user_id, "day_milestone", row.id, String(day));
      if (!claimed) continue;
      await sendPushToUser(
        row.user_id,
        { title: "WHS After Mate", body: `${row.care_name} 관리 ${day}일째예요. 오늘의 사후관리 가이드를 확인해보세요.` },
        "care",
      );
    }
  }
}

// 매일 19:00 KST — 오늘 시술 받은 고객에게 저녁에 알림("등록하자마자 축하 알림"은 어색해서 제외)
export async function runTodayCareRegisteredCheck() {
  const today = kstDateString(0);
  const { data, error } = await supabaseAdmin
    .from("care_records")
    .select("id, user_id, care_name")
    .eq("care_date", today);
  if (error) {
    // eslint-disable-next-line no-console
    console.error("[notificationScheduler] today-care 조회 실패:", error);
    return;
  }
  for (const row of (data ?? []) as { id: string; user_id: string; care_name: string }[]) {
    const claimed = await claimNotification(row.user_id, "care_registered", row.id, "registered");
    if (!claimed) continue;
    await sendPushToUser(
      row.user_id,
      { title: "WHS After Mate", body: `오늘 ${row.care_name} 관리를 받으셨어요. 고생하셨어요! 사후관리 가이드를 확인해보세요.` },
      "care",
    );
  }
}

const EXPIRY_MILESTONES = [30, 7];

// 매일 09:00 KST — 만료 30일 전/7일 전, 남은 횟수가 있는 이용권만
export async function runMembershipExpiryCheck() {
  for (const daysBefore of EXPIRY_MILESTONES) {
    const targetDate = kstDateString(-daysBefore);
    const { data, error } = await supabaseAdmin
      .from("memberships")
      .select("id, user_id, product_name, remaining_count")
      .eq("expires_at", targetDate)
      .gt("remaining_count", 0);
    if (error) {
      // eslint-disable-next-line no-console
      console.error("[notificationScheduler] membership-expiry 조회 실패:", error);
      continue;
    }
    for (const row of (data ?? []) as {
      id: string;
      user_id: string;
      product_name: string;
      remaining_count: number;
    }[]) {
      const claimed = await claimNotification(row.user_id, "membership_expiry", row.id, String(daysBefore));
      if (!claimed) continue;
      await sendPushToUser(
        row.user_id,
        {
          title: "WHS After Mate",
          body: `${row.product_name} 이용권이 ${daysBefore}일 후 만료돼요. 남은 ${row.remaining_count}회를 확인해보세요.`,
        },
        "care",
      );
    }
  }
}

// FCM_ENABLED=false면 server.ts가 아예 호출하지 않는다 — 어차피 못 보낼 걸 매일 폴링할 이유가 없다.
export function startNotificationScheduler() {
  schedule(
    "0 9 * * *",
    () => {
      runDayMilestoneCheck().catch((err) => console.error("[notificationScheduler] day-milestone 실패:", err));
      runMembershipExpiryCheck().catch((err) => console.error("[notificationScheduler] membership-expiry 실패:", err));
    },
    { timezone: "Asia/Seoul" },
  );

  schedule(
    "0 19 * * *",
    () => {
      runTodayCareRegisteredCheck().catch((err) => console.error("[notificationScheduler] today-care 실패:", err));
    },
    { timezone: "Asia/Seoul" },
  );

  // eslint-disable-next-line no-console
  console.log("[notificationScheduler] 알림 스케줄러 시작됨 (09:00, 19:00 KST)");
}
