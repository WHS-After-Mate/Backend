import { supabaseAdmin } from "../config/supabase";
import { Errors } from "../lib/errors";

// Android 클라이언트가 FCM 토큰을 발급받은 뒤 등록하는 지점 (api-spec.md 5절 확장 — FCM 전제 설계)
export async function registerDeviceToken(userId: string, fcmToken: string, platform: string) {
  const { error } = await supabaseAdmin
    .from("device_tokens")
    .upsert(
      { user_id: userId, fcm_token: fcmToken, platform, last_seen_at: new Date().toISOString() },
      { onConflict: "fcm_token" },
    );

  if (error) throw Errors.internal("디바이스 토큰 등록에 실패했습니다.");
}

export async function unregisterDeviceToken(userId: string, fcmToken: string) {
  await supabaseAdmin.from("device_tokens").delete().eq("user_id", userId).eq("fcm_token", fcmToken);
}
