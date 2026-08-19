-- WHS After Mate — treatment_catalog에 brand(클리닉) 컬럼 추가
-- 013에서 "치료 카탈로그는 클리닉마다 다를 이유가 없다"고 판단해 브랜드 구분을 뺐었지만,
-- 실제 엑셀 원본(docs/care_procedure_template.xlsx 시술 시트)엔 엠레드/더나/윔 클리닉별로
-- 서로 다른(때로는 겹치는 이름의) 시술 목록이 있었고, 관리자 웹의 "시술 등록" 화면에서
-- 로그인한 클리닉에 해당하는 시술만 보여야 한다는 요구사항이 확인돼 다시 추가한다.
--
-- brand는 당장은 nullable로 둔다 — 기존 10개 행(엠레드 5 + 더나 5 샘플)은 이 마이그레이션만으론
-- 브랜드가 채워지지 않고, 후속 작업(엑셀 45개 전체 재시딩)에서 브랜드까지 채워 넣을 예정이라
-- 그 전까지 과도기 상태를 허용해야 한다.
--
-- care_name 단독 unique는 같은 이름의 시술이 서로 다른 클리닉에 존재하는 경우(예: "슈링크
-- 유니버스"가 엠레드/더나 양쪽에 있음)를 다르게 취급하지 못해 (brand, care_name) 복합 unique로
-- 교체한다. brand가 NULL인 행끼리는(과도기 상태) Postgres 표준 동작상 서로 unique 제약에
-- 안 걸리므로 재시딩 전까지는 여전히 care_name 기준 upsert(onConflict: care_name)가 그대로 동작한다.

alter table public.treatment_catalog
  add column if not exists brand text;

comment on column public.treatment_catalog.brand is
  '이 시술을 등록한 클리닉(예: AMRED CLINIC/DERNA CLINIC/WIM Clinic). null이면 아직 브랜드 미배정
   (과도기 데이터 — 후속 재시딩에서 채워짐). GET /treatment-catalog가 이 값으로 로그인한 관리자의
   클리닉에 맞는 시술만 필터링하는 데 쓴다.';

alter table public.treatment_catalog
  drop constraint if exists treatment_catalog_care_name_key;

create unique index if not exists idx_treatment_catalog_brand_care_name
  on public.treatment_catalog (brand, care_name);
