-- WHS After Mate — 인증코드 발송 제거 + 환자 등록 필드 통합
-- (1) 회원가입 인증코드 발급/확인 절차를 없애고, patientNo+이름+생년월일 일치 여부로 신원을
--     확인하는 방식으로 바꿨다. signup_verification_codes 테이블은 더 이상 쓰이지 않아 제거한다.
-- (2) 환자 등록 입력을 이름/생년월일/전화번호/기타사항(알러지·기저질환·의사소견 통합 자유입력)
--     4개로 단순화한다. allergies/chronic_conditions/doctor_general_comment 3개 컬럼을
--     notes 하나로 합친다.

drop table if exists public.signup_verification_codes;

alter table public.emr_patients add column if not exists notes text;
alter table public.emr_patients drop column if exists allergies;
alter table public.emr_patients drop column if exists chronic_conditions;
alter table public.emr_patients drop column if exists doctor_general_comment;

comment on column public.emr_patients.notes is
  '기타사항 — 알러지/기저질환/의사소견을 하나로 합친 자유입력 텍스트. 회원가입(claim) 시
   medical_profiles.doctor_general_comment로 그대로 이관된다(allergies/chronic_conditions는 빈 배열).';
