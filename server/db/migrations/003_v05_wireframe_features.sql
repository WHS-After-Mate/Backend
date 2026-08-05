-- WHS After Mate — v0.5 와이어프레임 검토 반영분 (docs/db-schema.md v0.3 기준)
-- 최종 프론트 와이어프레임(WHS After Mate.png) 검토로 api-spec.md v0.5에 추가된
-- 9개 항목 중 실제 스키마 변경이 필요한 부분만 반영한다.
-- 비밀번호 재설정/변경, 추천 상세 확장 필드(relatedRecentCares 등)는 Supabase Auth 위임
-- 또는 기존 테이블 조합 즉석 계산으로 해결되어 이 마이그레이션에 포함되지 않는다.

-- ── profiles: 생년월일, 마케팅 알림 토글 ───────────────────────
alter table public.profiles
  add column if not exists birth_date date,
  add column if not exists marketing_alert boolean not null default false;

comment on column public.profiles.birth_date is
  '내 정보 화면의 생년월일 (GET /profile 응답 birthDate)';
comment on column public.profiles.marketing_alert is
  '설정 화면의 마케팅 알림 토글. 기본값 false(옵트인)';

-- ── care_records: 상태·회차·연결 이용권 ────────────────────────
-- memberships가 001_init.sql에서 먼저 생성되어 있어야 membership_id FK가 성립한다.
alter table public.care_records
  add column if not exists status text not null default 'completed',
  add column if not exists session_number int,
  add column if not exists total_sessions int,
  add column if not exists membership_id uuid references public.memberships(id) on delete set null;

comment on column public.care_records.status is
  '관리 상세/이력 목록의 상태 칩. 현재 값 후보는 completed 하나뿐(EMR 동기화 데이터는 이미 끝난 시술 위주)';
comment on column public.care_records.session_number is
  '관리 상세의 "관리 회차: N/M회차" 중 N. nullable — 회차 개념이 없는 단건 시술은 비워둠';
comment on column public.care_records.total_sessions is
  '관리 상세의 "관리 회차: N/M회차" 중 M';
comment on column public.care_records.membership_id is
  '이 시술이 차감한 이용권 FK. 이용권 삭제돼도 시술 기록은 보존(on delete set null)';

create index if not exists idx_care_records_membership
  on public.care_records (membership_id)
  where membership_id is not null;

-- ── membership_usages: 이용권 회차별 사용 이력 ──────────────────
create table if not exists public.membership_usages (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid not null references public.memberships(id) on delete cascade,
  care_record_id uuid references public.care_records(id) on delete set null,
  session_number int not null,
  used_at date not null,
  created_at timestamptz not null default now(),
  unique (membership_id, session_number)
);

comment on table public.membership_usages is
  '이용권 화면(GET /memberships, /memberships/{id})의 usageHistory. used_count(집계값)만으로는
   회차별 사용일자를 복원할 수 없어 별도 테이블로 분리.';

create index if not exists idx_membership_usages_membership
  on public.membership_usages (membership_id, session_number);
