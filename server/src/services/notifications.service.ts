import { supabaseAdmin } from "../config/supabase";
import { Errors } from "../lib/errors";

interface NotificationSettingsPatch {
  pushEnabled?: boolean;
  aftercareReminder?: boolean;
  membershipExpiryAlert?: boolean;
}

function toDto(row: { push_enabled: boolean; aftercare_reminder: boolean; membership_expiry_alert: boolean }) {
  return {
    pushEnabled: row.push_enabled,
    aftercareReminder: row.aftercare_reminder,
    membershipExpiryAlert: row.membership_expiry_alert,
  };
}

export async function getNotificationSettings(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("push_enabled, aftercare_reminder, membership_expiry_alert")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) throw Errors.noActiveCustomerProfile();
  return toDto(data);
}

export async function updateNotificationSettings(userId: string, patch: NotificationSettingsPatch) {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .update({
      ...(patch.pushEnabled !== undefined && { push_enabled: patch.pushEnabled }),
      ...(patch.aftercareReminder !== undefined && { aftercare_reminder: patch.aftercareReminder }),
      ...(patch.membershipExpiryAlert !== undefined && { membership_expiry_alert: patch.membershipExpiryAlert }),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .select("push_enabled, aftercare_reminder, membership_expiry_alert")
    .single();

  if (error || !data) throw Errors.noActiveCustomerProfile();
  return toDto(data);
}

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
