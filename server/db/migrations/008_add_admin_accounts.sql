-- WHS After Mate — 클리닉별 관리자 로그인 계정
-- admin-web(별도 저장소)에 로그인 화면을 추가하기로 결정 변경(기존 "무인증 데모" 결정을 뒤집음).
-- 클리닉(브랜드)마다 계정 1개씩, 총 3개(AMRED/DERNA/WIM)를 시드 스크립트로 미리 만들어 둔다.
-- 로그인한 계정의 brand/store가 이후 시술기록 추가 시 자동으로 채워지고(수동 입력 없음),
-- 조회도 로그인한 계정의 brand로만 격리된다(다른 클리닉 환자/기록은 안 보임) — server_admin 후속 작업에서 적용.

create table if not exists public.admin_accounts (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  password_hash text not null,
  -- emr_care_records.brand/store와 동일한 값을 써서 로그인 시 그대로 자동 채운다.
  brand text not null,
  store text not null,
  created_at timestamptz not null default now()
);

comment on table public.admin_accounts is
  '클리닉(브랜드)별 admin-web 로그인 계정. 시드 스크립트(server_admin/db/seed/seedAdmins.ts)로만 생성 —
   가입 API는 없음(클리닉이 3개로 고정이라 계정도 3개 고정).';
