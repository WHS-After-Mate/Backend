-- WHS After Mate — 초기 스키마 (docs/db-schema.md v0.2 기준)
-- Supabase SQL Editor 또는 `supabase db push`로 실행.
-- 계정/비밀번호/토큰은 Supabase Auth(auth.users)에 위임. 아래는 public 스키마.

create extension if not exists pgcrypto;

-- ── profiles ────────────────────────────────────────────────
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  phone text unique,
  phone_verified_at timestamptz,
  interest_goals text[] not null default '{}',
  push_enabled boolean not null default true,
  aftercare_reminder boolean not null default true,
  membership_expiry_alert boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── phone_verifications (가입 전 단계, 계정과 미연결) ─────────
create table if not exists public.phone_verifications (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts int not null default 0,
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_phone_verifications_phone_created
  on public.phone_verifications (phone, created_at desc);

-- ── care_records (클리닉 EMR 동기화 사본) ─────────────────────
create table if not exists public.care_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  care_name text not null,
  care_type text,
  care_date date not null,
  part_of_body text,
  brand text,
  store text,
  practitioner text,
  basic_aftercare_guide text[] not null default '{}',
  doctor_comment text,
  external_record_id text,
  source_system text not null default 'aac_emr',
  synced_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_care_records_user_date
  on public.care_records (user_id, care_date desc);

create unique index if not exists idx_care_records_external_id
  on public.care_records (external_record_id)
  where external_record_id is not null;

-- ── medical_profiles (민감정보, EMR 동기화 사본) ───────────────
create table if not exists public.medical_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  external_patient_id text unique,
  allergies text[] not null default '{}',
  chronic_conditions text[] not null default '{}',
  doctor_general_comment text,
  source_system text not null default 'aac_emr',
  synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── medical_data_access_log (민감정보 접근 감사 로그) ──────────
create table if not exists public.medical_data_access_log (
  id uuid primary key default gen_random_uuid(),
  patient_user_id uuid not null references auth.users(id) on delete cascade,
  accessed_by text not null,
  accessed_fields text[] not null,
  request_context text,
  accessed_at timestamptz not null default now()
);

create index if not exists idx_medical_access_log_patient
  on public.medical_data_access_log (patient_user_id, accessed_at desc);

-- ── memberships ────────────────────────────────────────────
create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_name text not null,
  total_count int not null default 0,
  used_count int not null default 0,
  remaining_count int generated always as (total_count - used_count) stored,
  expires_at date,
  last_used_at date,
  available_care_names text[] not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists idx_memberships_user_expiry
  on public.memberships (user_id, expires_at);

-- ── aftercare_guides (LLM 일차별 가이드 캐시) ──────────────────
create table if not exists public.aftercare_guides (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  care_record_id uuid not null references public.care_records(id) on delete cascade,
  days_elapsed int not null,
  elapsed_range text,
  must_avoid text[] not null default '{}',
  basic_care text[] not null default '{}',
  next_check_date date,
  generated_at timestamptz not null default now(),
  generated_by text not null default 'llm',
  generated_date date generated always as
    ((generated_at at time zone 'Asia/Seoul')::date) stored,
  cache_expires_at timestamptz not null,
  unique (care_record_id, generated_date)
);

-- ── questions ──────────────────────────────────────────────
create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  care_record_id uuid references public.care_records(id) on delete set null,
  category text not null,
  question text not null,
  status text not null check (status in ('answered', 'out_of_scope', 'expert_required')),
  answer text,
  answered_by text default 'llm',
  expert_contact_required boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_questions_user_created
  on public.questions (user_id, created_at desc);
