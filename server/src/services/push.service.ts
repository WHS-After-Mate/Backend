import { getMessaging } from "../config/firebase";
import { supabaseAdmin } from "../config/supabase";

// aftercareReminder / membershipExpiryAlert 발송용 (스케줄러/배치에서 호출 예정 — MVP 범위 밖, 배선만 준비)
export async function sendPushToUser(userId: string, notification: { title: string; body: string }) {
  const messaging = getMessaging();
  if (!messaging) return; // FCM_ENABLED=false면 조용히 스킵

  const { data: tokens } = await supabaseAdmin.from("device_tokens").select("fcm_token").eq("user_id", userId);
  if (!tokens || tokens.length === 0) return;

  await messaging.sendEachForMulticast({
    tokens: tokens.map((t) => t.fcm_token as string),
    notification,
  });
}
