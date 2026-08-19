-- WHS After Mate — treatment_catalog.care_type을 nullable로 완화
-- 엑셀 원본(docs/care_procedure_template.xlsx) 45개 시술을 브랜드별로 전체 시딩하면서, 그중
-- 다수(특히 WIM 센터의 웰니스 회복 기기 7종 전부)가 지금 존재하는 7개 care_type(peeling/
-- laser_toning/energy_lifting/botox/filler/skin_booster/hair_removal) 중 어디에도 맞지 않는다는
-- 게 확인됐다. 억지로 비슷한 값에 끼워맞추면 daily-guide가 엉뚱한 사후관리 내용을 보여줄 위험이
-- 있어, 확실히 매칭되는 시술만 care_type을 채우고 나머지는 null로 둔다.
-- null이어도 문제 없다 — lookupCareType()이 이미 "카탈로그에 매칭 안 되면 null"을 정상 상태로
-- 다루고 있고(care_records.care_type도 원래 nullable), 그 경우 daily-guide만 기존과 동일하게
-- 404(GUIDE_NOT_AVAILABLE)로 폴백될 뿐 시술 등록/필터링 등 다른 기능엔 영향 없다.

alter table public.treatment_catalog
  alter column care_type drop not null;
