-- WHS After Mate — 시술기록의 관리 부위(part_of_body)를 단일 텍스트에서 배열로 변경
-- 관리 상세 화면(와이어프레임 11번)처럼 한 시술이 여러 부위에 동시에 이뤄질 수 있어(예: "이마+미간"),
-- 중복 선택 가능한 배열 컬럼으로 바꾼다. 값은 정해진 부위 목록 중에서만 고를 수 있도록
-- server_admin에서 검증한다(GET /body-parts로 목록 노출).
-- 데모 단계라 기존 값은 보존하지 않고 컬럼을 재생성한다(기존 시드 데이터는 npm run seed로 재시드).

alter table public.emr_care_records drop column if exists part_of_body;
alter table public.emr_care_records add column part_of_body text[] not null default '{}';

alter table public.care_records drop column if exists part_of_body;
alter table public.care_records add column part_of_body text[] not null default '{}';
