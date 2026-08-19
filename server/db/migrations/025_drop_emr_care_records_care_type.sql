-- WHS After Mate — emr_care_records.care_type 삭제 (024의 후속)
-- 024가 care_records/treatment_catalog의 care_type은 지웠지만 이 스테이징 테이블은 놓쳤다.
-- server_admin의 addCareRecord()가 이미 care_type을 전혀 안 보내고 있어(patients.service.ts,
-- createCareRecordSchema에 careType 필드 자체가 없음) 컬럼이 여전히 not null로 남아있는 한
-- claim 전 환자(emr_patients, claimed_user_id is null)에게 시술기록을 등록하는 모든 요청이
-- "null value in column care_type violates not-null constraint"로 실패한다.

alter table public.emr_care_records drop column if exists care_type;
