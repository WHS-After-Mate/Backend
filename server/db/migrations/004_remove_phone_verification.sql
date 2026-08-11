-- WHS After Mate — 전화번호 SMS 인증 기능 제거
-- SMS 실제 연동이 MVP 범위 밖으로 확정되어(server/README.md TODO 참고),
-- verify-phone/request·confirm 엔드포인트와 phoneVerifiedToken 흐름을 코드에서 걷어냈다.
-- 그에 맞춰 인증 코드를 저장하던 테이블과, 프로필의 인증완료 시각 컬럼을 제거한다.
-- profiles.phone 컬럼(연락처 값)과 unique 제약은 그대로 유지한다.

drop table if exists public.phone_verifications;

alter table public.profiles
  drop column if exists phone_verified_at;
