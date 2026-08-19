-- WHS After Mate — 예약(미래 careDate) 등록 시 이용권 미차감 지원
-- 지금까지는 시술기록을 등록하는 순간(careDate와 무관하게) 항상 이용권 1회를 차감했다 — 그 결과
-- 같은 패키지로 여러 미래 예약(예: 다음주 보톡스 3회권, 다다음주 보톡스 3회권)을 잡으면 실제로는
-- 아직 아무 시술도 안 받았는데 이용권이 먼저 다 소진되는 문제가 있었다. 이제 차감은 careDate가
-- 오늘(KST)인 등록에만 일어나고, 그 외 날짜는 이용권을 연결만 하고 차감하지 않는다(등록 시점
-- 기준 — 나중에 그 날짜가 와도 자동으로 차감되지 않으며, 실제 시술일에 별도로 등록해야 차감된다).
--
-- 이 컬럼은 그 시술기록 건이 등록 당시 실제로 이용권 1회를 차감했는지를 기록한다 — DELETE
-- /care-records/{id}가 이용권을 되돌릴 때(patients.service.ts의 tryDeleteCareRecordFrom) 이
-- 값을 보고 "차감 안 됐던 예약"을 지울 땐 used_count를 잘못 되돌리지 않도록 하기 위함이다.
-- 기존 행은 전부 이 기능 도입 이전에 차감된 것들이라 기본값 true로 백필한다.

alter table public.care_records
  add column if not exists session_consumed boolean not null default true;

alter table public.emr_care_records
  add column if not exists session_consumed boolean not null default true;
