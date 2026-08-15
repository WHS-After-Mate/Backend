-- WHS After Mate — emr_memberships에 잔여횟수(remaining_count) 생성 컬럼 추가
-- 실제 고객용 memberships 테이블(001_init.sql)과 동일한 패턴. 시술기록 추가(D) 화면에서
-- "이 이용권 몇 회 남았는지" 토글 목록을 보여줄 때 프론트가 total_count-used_count를 직접
-- 계산하지 않아도 되도록, DB가 항상 최신값을 들고 있게 한다.

alter table public.emr_memberships
  add column if not exists remaining_count int generated always as (total_count - used_count) stored;
