-- WHS After Mate — 알림 설정(GET/PATCH /profile/notifications) 재도입
-- 005에서 걷어냈던 것과 달리, 이번엔 push.service.sendPushToUser가 kind별로 이 값을 실제로
-- 읽어 분기하므로(꺼져 있으면 발송 스킵) placeholder가 아니다.
-- 예전 4컬럼(push_enabled/aftercare_reminder/membership_expiry_alert/marketing_alert) 대신
-- care/marketing 2가지로 단순화.

alter table public.profiles
  add column if not exists care_notification boolean not null default true,
  add column if not exists marketing_notification boolean not null default true;
