-- WHS After Mate — memberships에 emr_memberships 출처를 추적할 external_record_id 추가
-- 회원 탈퇴(DELETE /profile) 시 가입 이후 새로 생긴 이용권만 emr_memberships로 되돌리고, 원래
-- emr_memberships에서 이관(claim)돼 온 이용권은 중복 생성하지 않고 원본을 갱신하기 위해서는
-- "이 memberships 행이 어느 emr_memberships 행에서 왔는지" 구분할 수 있어야 한다.
-- care_records.external_record_id(001_init.sql)와 동일한 역할이지만 memberships엔 그 컬럼이
-- 없었으므로 신규 추가. 기존 행은 전부 이 기능 도입 이전에 이관된 것들이라 출처를 알 수 없어
-- null로 둔다(탈퇴 시 이 행들은 "가입 후 신규"로 간주돼 새 emr_memberships로 만들어짐 — 데이터
-- 유실보다는 안전한 방향).

alter table public.memberships
  add column if not exists external_record_id uuid;

create unique index if not exists idx_memberships_external_id
  on public.memberships (external_record_id)
  where external_record_id is not null;
