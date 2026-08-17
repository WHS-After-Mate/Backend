-- WHS After Mate — 실제 사업장/시술 카탈로그(관리 추천용) 신규 추가
-- docs/care_procedure_template.xlsx(사업장 3곳 · 실시술 46개) + docs/care_recommendation_data_guide.md
-- 설계를 반영한다. 기존 recommendations.service.ts는 고객이 "이미 보유한 이용권(memberships)"
-- 안에서만 추천 후보를 골랐는데(availableCareNames), 이번 변경으로 실제 사업장 전체 카탈로그 중
-- concernTag(고객 관심목표, profiles.interest_goals)가 겹치는 시술을 추천하는 방식으로 교체한다.

create table if not exists public.businesses (
  id text primary key,
  name text not null,
  -- admin_accounts.brand/care_records.brand와 동일한 값(예: "AMRED CLINIC") — 고객의 실제 시술기록
  -- (brand+care_name)을 이 카탈로그의 procedures 행과 대조할 때 쓴다. FK 아님(기존 브랜드 매칭 관례와 동일).
  brand text not null unique,
  talk_channel_label text,
  talk_channel_url text,
  phone text
);

comment on table public.businesses is
  '실제 사업장 3곳(엠레드/더나/윔) 공개 정보 — 상담 채널(카카오톡)/전화번호. 관리 추천 상세 화면에서
   추천된 시술의 사업장 연락처를 보여주는 데 쓴다.';

create table if not exists public.procedures (
  id uuid primary key default gen_random_uuid(),
  business_id text not null references public.businesses(id),
  name text not null,
  -- concernTags(고정 10개, server/src/lib/concernTags.ts) 중 이 시술이 다루는 고민 영역.
  category_tags text[] not null default '{}',
  description text,
  created_at timestamptz not null default now(),
  unique (business_id, name)
);

comment on table public.procedures is
  '사업장별 실제 시술 카탈로그(46개, 2026-08-17 xlsx 기준 — care_procedure_template.xlsx). 관리 추천은
   고객 interest_goals와 category_tags가 겹치는 시술을 이 테이블 전체에서 찾는다(이용권 보유 여부 무관).';
