import { getMessaging } from "../config/firebase";
import { supabaseAdmin } from "../config/supabase";

// 사후관리 안내(care) vs 마케팅(marketing) — profiles.care_notification/marketing_notification
// (PATCH /profile/notifications로 사용자가 끌 수 있음) 중 해당 종류가 꺼져 있으면 발송 스킵
export type PushKind = "care" | "marketing";

const SETTING_COLUMN: Record<PushKind, "care_notification" | "marketing_notification"> = {
  care: "care_notification",
  marketing: "marketing_notification",
};

// 사후관리/이용권 만료 리마인더 발송용 (스케줄러/배치에서 호출 예정 — MVP 범위 밖, 배선만 준비)
export async function sendPushToUser(
  userId: string,
  notification: { title: string; body: string },
  kind: PushKind,
) {
  const messaging = getMessaging();
  if (!messaging) return; // FCM_ENABLED=false면 조용히 스킵

  const { data: profileRow } = await supabaseAdmin
    .from("profiles")
    .select("care_notification, marketing_notification")
    .eq("user_id", userId)
    .maybeSingle();
  const profile = profileRow as { care_notification: boolean; marketing_notification: boolean } | null;
  if (!profile || profile[SETTING_COLUMN[kind]] === false) return; // 사용자가 해당 종류 알림을 꺼둔 경우 스킵

  const { data: tokens } = await supabaseAdmin.from("device_tokens").select("fcm_token").eq("user_id", userId);
  if (!tokens || tokens.length === 0) return;

  const result = await messaging.sendEachForMulticast({
    tokens: tokens.map((t) => t.fcm_token as string),
    notification,
  });
  // sendEachForMulticast는 토큰이 전부 실패해도 reject하지 않는다(HTTP 요청 자체는 성공) — 결과를
  // 안 들여다보면 "SenderId mismatch"(앱이 다른 Firebase 프로젝트를 쓰는 경우) 같은 설정 오류가
  // 콘솔에 아무 흔적도 안 남기고 조용히 묻힌다. 실패한 토큰만 코드/메시지와 함께 로그로 남긴다.
  if (result.failureCount > 0) {
    result.responses.forEach((r, i) => {
      if (r.success) return;
      // eslint-disable-next-line no-console
      console.error(
        `[push.service] 발송 실패 userId=${userId} token=${tokens[i].fcm_token.slice(0, 12)}… code=${r.error?.code} message=${r.error?.message}`,
      );
    });
  }
}
