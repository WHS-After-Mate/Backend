-- WHS After Mate — store 컬럼 제거 + emr_patients에 소속 클리닉(brand) 추가
-- (1) store는 지금 클리닉당 지점이 1곳뿐이라 brand와 항상 1:1이었다(예: AMRED CLINIC ↔ AMRED CLINIC 청담점).
--     별도로 관리할 정보가 아니라 순수 중복이라 판단해 care_records/emr_care_records/admin_accounts에서 제거한다.
-- (2) 클리닉 관리자 로그인(admin_accounts, 008)이 생기면서 "로그인한 클리닉의 환자만 보인다"는
--     격리 규칙이 필요해졌다. emr_patients엔 지금까지 소속 클리닉 정보가 아예 없었으므로,
--     환자 등록(POST /patients) 시점에 로그인한 관리자의 brand를 그대로 기록하도록 컬럼을 추가한다.
--     기존 환자 데이터는 소급 지정이 필요해 일단 nullable로 추가 — 백필 스크립트로 채운 뒤 NOT NULL로
--     바꾸는 후속 마이그레이션(010)이 이어진다.

alter table public.care_records drop column if exists store;
alter table public.emr_care_records drop column if exists store;
alter table public.admin_accounts drop column if exists store;

alter table public.emr_patients add column if not exists brand text;

comment on column public.emr_patients.brand is
  '환자를 등록한 클리닉(admin_accounts.brand와 매칭). 로그인한 관리자는 자기 클리닉의 brand와
   일치하는 환자만 조회 가능 — server_admin의 클리닉별 데이터 격리 근거.';
