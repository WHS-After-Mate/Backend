-- WHS After Mate — memberships/emr_memberships에 brand(발급 클리닉) 컬럼 추가
-- 프론트(앱) 연동 중 GET /memberships 응답에 "이 이용권을 어느 클리닉에서 만들었는지"가 필요하다는
-- 요청이 들어왔다. care_records/emr_care_records는 처음부터 brand를 갖고 있었지만(009), 짝을 이루는
-- memberships/emr_memberships에는 그동안 brand가 없었다 — 이용권은 시술기록과 항상 1:1로 같이
-- 만들어지므로(server_admin의 addCareRecord), 만들어질 때의 brand를 그대로 함께 저장하면 된다.
--
-- 기존 행 백필: 이 프로젝트는 "이용권 추가"라는 별도 행위가 없고 항상 시술기록과 함께 생성되므로,
-- 모든 memberships/emr_memberships 행은 자신을 만든 care_records/emr_care_records 행을
-- membership_id로 정확히 하나 이상 갖고 있다 — 그중 가장 먼저 만들어진(=이 이용권을 최초로
-- 생성한) 기록의 brand를 그대로 가져온다.
--
-- 주의: 이 컬럼은 순수 표시용 메타데이터다 — 이용권 차감/자동 이어쓰기 매칭 로직
-- (server_admin의 findContinuableMembership)은 지금과 마찬가지로 brand와 무관하게
-- product_name+total_count만으로 매칭한다(기존에 문서화된 "이용권은 클리닉별로 격리되지
-- 않음" 정책 그대로 — 이번 변경으로 바뀌지 않음).

alter table public.memberships add column if not exists brand text;
alter table public.emr_memberships add column if not exists brand text;

update public.memberships m
set brand = cr.brand
from (
  select distinct on (membership_id) membership_id, brand
  from public.care_records
  where membership_id is not null
  order by membership_id, created_at asc
) cr
where cr.membership_id = m.id
  and m.brand is null;

update public.emr_memberships m
set brand = cr.brand
from (
  select distinct on (membership_id) membership_id, brand
  from public.emr_care_records
  where membership_id is not null
  order by membership_id, created_at asc
) cr
where cr.membership_id = m.id
  and m.brand is null;

comment on column public.memberships.brand is
  '이 이용권을 처음 만든 클리닉(생성 시점의 care_records.brand와 동일). 표시용 메타데이터일 뿐,
   차감/자동 이어쓰기 매칭에는 쓰이지 않는다 — 이용권은 여전히 클리닉 간 격리되지 않음.';
comment on column public.emr_memberships.brand is
  '위 memberships.brand와 동일한 의미, claim 전 스테이징 버전.';
