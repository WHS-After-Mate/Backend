-- WHS After Mate — 알림 설정(GET/PATCH /notifications/settings) 제거
-- push_enabled/aftercare_reminder/membership_expiry_alert/marketing_alert 네 컬럼 모두
-- 저장만 될 뿐 실제로 읽어 분기하는 코드가 없는 placeholder였다(발송 스케줄러 자체가 미구현).
-- 알림설정 엔드포인트를 걷어내는 김에 컬럼도 함께 제거한다.
-- device_tokens 테이블(FCM 토큰 등록/해제)은 실제로 쓰이므로 그대로 유지한다.

alter table public.profiles
  drop column if exists push_enabled,
  drop column if exists aftercare_reminder,
  drop column if exists membership_expiry_alert,
  drop column if exists marketing_alert;
