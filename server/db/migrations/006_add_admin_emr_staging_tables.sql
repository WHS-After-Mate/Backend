-- WHS After Mate — 관리자(admin-web/server_admin) 가상 EMR 스테이징 테이블
-- 실제 클리닉처럼 "환자가 앱에 가입하기 전에" 의료진이 먼저 환자 정보·시술 이력을 입력할 수 있도록,
-- auth.users와 무관하게 독립적으로 존재하는 스테이징 테이블 4종을 추가한다.
-- 환자가 발급받은 환자번호(patient_no) + 인증코드로 회원가입(POST /auth/signup)을 완료하면
-- 이 테이블들의 데이터가 실제 profiles/medical_profiles/care_records/memberships로 1회성 이관(claim)된다.
-- server_admin은 이 4개 테이블만 다루고, server/의 기존 고객용 테이블은 건드리지 않는다.

-- ── emr_patients (환자 프로필, 계정 미연결 상태로 시작) ───────────
create table if not exists public.emr_patients (
  id uuid primary key default gen_random_uuid(),
  patient_no text not null unique,
  name text not null,
  birth_date date not null,
  phone text not null,
  allergies text[] not null default '{}',
  chronic_conditions text[] not null default '{}',
  doctor_general_comment text,
  -- 앱 가입(claim) 완료 시 채워짐. null이면 아직 미가입 상태.
  claimed_user_id uuid references auth.users(id) on delete set null,
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.emr_patients.patient_no is
  '병원에서 발급하는 환자번호. 앱 회원가입 시 인증코드와 함께 입력받아 신원 확인에 사용';
comment on column public.emr_patients.claimed_user_id is
  '회원가입으로 이 환자 기록을 실제 계정에 연결(claim)한 시점의 auth.users.id. 중복 가입 방지 겸 이관 완료 표시';

create index if not exists idx_emr_patients_phone on public.emr_patients (phone);

-- ── emr_care_records (계정 연결 전 시술 이력) ──────────────────────
create table if not exists public.emr_care_records (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.emr_patients(id) on delete cascade,
  care_name text not null,
  care_type text not null,
  care_date date not null,
  part_of_body text,
  brand text,
  store text,
  practitioner text,
  basic_aftercare_guide text[] not null default '{}',
  doctor_comment text,
  session_number int,
  total_sessions int,
  created_at timestamptz not null default now()
);

comment on column public.emr_care_records.care_type is
  '/aftercare/daily-guide 매칭용 내부 키. reference_guides에 등록된 값(현재 peeling/laser_toning)만
   실제 일차별 가이드가 생성되고, 그 외 값은 클레임 후 404 GUIDE_NOT_AVAILABLE로 안전하게 폴백됨';

create index if not exists idx_emr_care_records_patient on public.emr_care_records (patient_id, care_date desc);

-- ── emr_memberships (계정 연결 전 이용권) ──────────────────────────
create table if not exists public.emr_memberships (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.emr_patients(id) on delete cascade,
  product_name text not null,
  total_count int not null default 0,
  used_count int not null default 0,
  expires_at date,
  last_used_at date,
  available_care_names text[] not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists idx_emr_memberships_patient on public.emr_memberships (patient_id);

-- ── signup_verification_codes (환자번호 기반 가입 인증코드) ────────
create table if not exists public.signup_verification_codes (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.emr_patients(id) on delete cascade,
  code text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

comment on table public.signup_verification_codes is
  '데스크에서 발급 버튼을 누르면 24시간 유효한 코드가 생성됨(실제 SMS 발송 없음 — admin-web 화면에 표시해 안내하는 방식).
   POST /auth/signup에서 patientNo+code가 일치·미사용·미만료 확인되면 사용 처리(used_at)하고 emr_patients를 claim한다.';

create index if not exists idx_signup_codes_patient on public.signup_verification_codes (patient_id, created_at desc);
create index if not exists idx_signup_codes_lookup on public.signup_verification_codes (patient_id, code) where used_at is null;
