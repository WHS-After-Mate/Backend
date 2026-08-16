-- WHS After Mate — 치료-부위 카탈로그(treatment_catalog) 신규 추가
-- 관리자 웹 프로토타입(docs/WHS_After_Mate_Admin_revised.html)의 "관리 등록" 모달처럼, 치료명을
-- 고르면 그 치료에 해당하는 관리 부위 후보를 자동으로 보여주기 위한 참조 테이블. 클리닉(브랜드)별로
-- 나누지 않고 전체 클리닉 공통으로 관리한다(치료 카탈로그 자체는 클리닉마다 다를 이유가 없다는 판단).
-- care_type은 /aftercare/daily-guide 매칭용 careType과 동일한 값(reference_guides에 등록된 값)이어야
-- 하며, service 레이어(assertValidCareType)에서 생성/수정 시 그대로 재검증한다.

create table if not exists public.treatment_catalog (
  id uuid primary key default gen_random_uuid(),
  care_name text not null unique,
  care_type text not null,
  body_parts text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.treatment_catalog is
  '치료명 → 기본 careType/관리 부위 후보 매핑. 관리자가 시술기록 등록 시 치료명을 고르면
   이 테이블 값으로 careType/부위 선택지를 자동 제안하는 데 쓴다(강제 아님 — 관리자가 직접 덮어쓸 수 있음).';
