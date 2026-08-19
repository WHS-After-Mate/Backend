import { getMessaging } from "../config/firebase";
import { supabaseAdmin } from "../config/supabase";

// 시술 등록(addCareRecord) 즉시 알림 전용 — profiles.care_notification이 꺼져 있으면 스킵.
// server/의 sendPushToUser(kind별 분기)와 달리 이쪽은 항상 care 알림 하나뿐이라 kind 파라미터가 없다.
export async function sendCareRegisteredPush(userId: string, notification: { title: string; body: string }) {
  const messaging = getMessaging();
  if (!messaging) return;

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("care_notification")
    .eq("user_id", userId)
    .maybeSingle<{ care_notification: boolean }>();
  if (!profile || profile.care_notification === false) return;

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
