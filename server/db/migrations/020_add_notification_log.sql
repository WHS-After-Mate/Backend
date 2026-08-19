-- WHS After Mate — 알림 발송 로그(중복 발송 방지 + 감사 기록)
-- 3종 알림이 이 테이블을 공유한다:
--   care_registered  — server_admin의 addCareRecord()가 시술 등록 즉시 발송(ref_key: 'registered')
--   day_milestone    — server의 일일 9시 크론(ref_key: '1'/'3'/'5'/'7'/'14')
--   membership_expiry— server의 일일 9시 크론(ref_key: '30'/'7')
-- (type, ref_id, ref_key) unique로 같은 알림이 중복 발송되는 것을 막는다.

create table if not exists public.notification_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  ref_id uuid not null,
  ref_key text not null,
  sent_at timestamptz not null default now(),
  unique (type, ref_id, ref_key)
);

create index if not exists idx_notification_log_user on public.notification_log (user_id, sent_at desc);
