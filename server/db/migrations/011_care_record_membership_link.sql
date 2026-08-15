-- WHS After Mate — emr_care_records에 이 기록이 소비한 이용권(membership_id) 연결
-- 지금까지는 시술기록과 이용권이 같이 만들어지긴 해도 서로를 가리키는 FK가 없어서,
-- 시술기록을 지울 때 그 이용권 차감을 되돌릴 방법이 없었다(별도 "이용권 삭제" API로 관리자가
-- 수동 정리하는 수밖에 없었음). 이 컬럼으로 연결해두면 시술기록 삭제 시 이용권도 자동으로
-- 같이 정리(차감 취소 또는 이용권 자체 삭제)할 수 있다 — server_admin/patients.service.ts 참고.

alter table public.emr_care_records
  add column if not exists membership_id uuid references public.emr_memberships(id) on delete set null;

create index if not exists idx_emr_care_records_membership on public.emr_care_records (membership_id);
