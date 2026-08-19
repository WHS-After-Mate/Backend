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

  await messaging.sendEachForMulticast({
    tokens: tokens.map((t) => t.fcm_token as string),
    notification,
  });
}
