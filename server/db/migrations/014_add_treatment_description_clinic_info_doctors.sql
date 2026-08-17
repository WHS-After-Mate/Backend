-- WHS After Mate — 치료 설명 컬럼 + 담당 의료진 테이블 추가
-- AAC 실제 사업장(엠레드/더나) 시술 데이터를 반영하면서 treatment_catalog에 설명 텍스트 컬럼을
-- 추가하고, 클리닉별 담당 의료진 이름 목록을 신규 테이블로 관리한다.
-- (원래 카카오톡 상담 링크/전화번호도 별도 clinics 테이블로 만들 계획이었으나, 이후 015에서 같은
-- 목적의 public.businesses 테이블이 실제 xlsx 데이터로 이미 3개 클리닉 전부 채워져 만들어졌음을
-- 발견 — 중복을 피해 clinics 테이블은 만들지 않고 businesses를 그대로 재사용한다.)

alter table public.treatment_catalog
  add column if not exists description text;

comment on column public.treatment_catalog.description is
  '시술 설명 텍스트(관리자 웹/고객 앱에 노출 가능). 선택 입력.';

create table if not exists public.clinic_doctors (
  id uuid primary key default gen_random_uuid(),
  brand text not null,
  name text not null,
  created_at timestamptz not null default now(),
  unique (brand, name)
);

comment on table public.clinic_doctors is
  '클리닉(브랜드)별 담당 의료진 이름 목록. 관리 등록 화면에서 로그인한 클리닉 소속 의료진 중
   select로 담당의(practitioner)를 고르는 용도 — care_records.practitioner는 여전히 자유 텍스트라
   여기 없는 이름도 입력은 가능하다(강제 아님, 후보 제안일 뿐).';
