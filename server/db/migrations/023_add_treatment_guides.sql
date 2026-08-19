-- WHS After Mate — care_type/reference_guides 기반 매칭을 시술명(care_name) 기반 고정 콘텐츠로 교체
-- 팀원 피드백: care_type이 같아도 시술마다(장비/성분이 달라) 실제 사후관리 내용이 다르다 —
-- care_type 그룹핑 대신 시술명별로 직접 콘텐츠를 작성해 저장한다. 앱의 daily-guide 화면이
-- 1/3/5/7/14일차만 사용하므로(그 외 날짜는 화면 자체가 없음) 이 5개 날짜만 다룬다.
-- brand로 나누지 않고 care_name만으로 키를 잡는다 — 같은 시술명(예: "슈링크 유니버스")이
-- 여러 클리닉에 있어도 실제 시술 내용/사후관리는 동일하므로 콘텐츠를 중복 작성할 이유가 없다.

create table if not exists public.treatment_guides (
  id uuid primary key default gen_random_uuid(),
  care_name text not null,
  day int not null check (day in (1, 3, 5, 7, 14)),
  key_care text not null,
  aftercare text[] not null,
  precautions text[] not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (care_name, day)
);

comment on table public.treatment_guides is
  '시술명(care_name) + 경과일(1/3/5/7/14만) 기준 고정 사후관리 콘텐츠. care_type/reference_guides를
   대체한다 — LLM 호출 없이 바로 응답 가능(비용 절감), 매칭 없으면 aftercare.service.ts가 기존처럼
   LLM로 폴백한다.';
