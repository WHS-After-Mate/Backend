-- WHS After Mate — 추가 스키마 v0.1
-- 검수된 관리 가이드(RAG 소스)와 Android FCM 디바이스 토큰 저장.
-- docs/db-schema.md, docs/llm-prompt-design.md의 "미확정 사항"이었던
-- "검수 가이드 저장 형식/위치"를 DB 테이블 방식으로 확정한다.
-- 이유: 관리 유형 x 경과구간 조합이 적고(수십 건 이내), LLM 프롬프트가
-- 매 호출마다 이 테이블을 조회해 컨텍스트로 주입하므로 정적 파일보다
-- 운영 중 검수자가 직접 수정하기 쉬운 DB 테이블이 낫다고 판단.

create table if not exists public.reference_guides (
  id uuid primary key default gen_random_uuid(),
  care_type text not null,
  elapsed_range_start int not null,
  elapsed_range_end int not null,
  elapsed_range_label text not null,
  must_avoid text[] not null default '{}',
  basic_care text[] not null default '{}',
  next_check_offset_days int,
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (care_type, elapsed_range_start, elapsed_range_end)
);

comment on table public.reference_guides is
  'LLM daily-guide/questions 프롬프트의 유일한 사실 근거(RAG 소스). 전문가 검수 후 등록.';
comment on column public.reference_guides.care_type is
  'care_records.care_type과 매칭되는 정규화 키 (예: peeling, laser_toning)';

-- ── device_tokens (Android FCM 푸시 토큰) ──────────────────────
create table if not exists public.device_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  fcm_token text not null unique,
  platform text not null default 'android',
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists idx_device_tokens_user
  on public.device_tokens (user_id);
