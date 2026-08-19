-- WHS After Mate — care_type 개념 완전 제거
-- daily-guide/questions 둘 다 treatment_guides(시술명+정확한 일차 직접 매칭)로 넘어가면서
-- care_type은 더 이상 어디에서도 읽지 않는다(아래 세 테이블 모두 애플리케이션 코드에서 참조 제거
-- 완료 — server/src, server_admin/src grep 확인). reference_guides/aftercare_guides도 같은 이유로
-- 완전히 죽은 테이블이라 함께 정리한다.
--
-- reference_guides: care_type 그룹 단위 검수 가이드 원문 — treatment_guides(시술명 단위, 팀이
-- 직접 작성한 콘텐츠)로 완전히 대체됐다.
-- aftercare_guides: LLM 생성 결과 캐시 — daily-guide가 이제 LLM을 아예 호출하지 않아(treatment_guides
-- 직접 조회) 캐시할 대상 자체가 없다.

alter table public.care_records drop column if exists care_type;
alter table public.treatment_catalog drop column if exists care_type;

drop table if exists public.reference_guides;
drop table if exists public.aftercare_guides;
