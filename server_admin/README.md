# WHS After Mate — Admin Server

`admin-web`(관리자 홈페이지)이 호출하는 백엔드. 실제 클리닉 데스크가 환자를 접수하듯,
**아직 앱 계정이 없는 환자의 이름·생년월일·전화번호·시술 이력·이용권을 먼저 입력**해두는 가상 EMR 데이터 입력 도구다.

## `server/`와의 관계

- **같은 Supabase 프로젝트**를 공유한다 — `.env`의 `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`는 `server/.env`와 동일한 값이어야 한다.
- 다만 여기서 쓰는 `emr_patients`/`emr_care_records`/`emr_memberships`/`signup_verification_codes` 4개 테이블은
  `auth.users`와 **무관하게 독립적으로 존재**한다 — 마이그레이션은 `server/db/migrations/006_add_admin_emr_staging_tables.sql`.
- 환자가 실제로 앱에 가입할 때(`POST /auth/signup` — `server/`), **환자번호(patientNo) + 이 서버에서 발급한 인증코드**를 입력하면
  그 순간 이 스테이징 테이블의 데이터가 `profiles`/`medical_profiles`/`care_records`/`memberships`로 **1회성 이관(claim)**된다.
  이관 이후 이 환자에게 추가로 시술기록/이용권/인증코드를 등록하려 하면 `409 PATIENT_ALREADY_CLAIMED`로 막힌다
  (claim 이후의 추가 입력은 앱 DB로 동기화되지 않기 때문 — 지속적 동기화는 이번 범위 밖).
- 인증코드는 **실제 SMS 발송을 하지 않는다.** 발급 API 응답에 코드가 그대로 담겨 있고, admin-web 화면에 표시해 데스크에서
  환자에게 안내하는 방식이다(SMS 연동은 `server/`에서도 비용 문제로 걷어낸 전례가 있음).

## 설정

```bash
cp .env.example .env   # SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY를 server/.env와 동일하게 채운다
npm install
npm run dev             # 기본 포트 4100
```

마이그레이션 006이 아직 Supabase에 적용 안 됐다면 SQL Editor에서 먼저 실행해야 한다(001~005와 동일한 방식).

## API 없이 로그인이 없다

`admin-web`은 데모 단계에서 별도 인증 없이 항상 열려 있는 내부 도구로 결정됨 — `requireAuth` 미들웨어가 없다.
실제 서비스 전환 시에는 반드시 별도 관리자 인증을 추가해야 한다(현재는 의도적 미구현).

## 엔드포인트

| Method | Path | 설명 |
|---|---|---|
| POST | `/api/v1/patients` | 환자 등록 (이름/생년월일/전화번호 + 선택: 알러지/기저질환/의사소견) → 환자번호 발급 |
| GET | `/api/v1/patients?search=` | 환자 목록/검색 (이름·전화번호·환자번호 부분일치) |
| GET | `/api/v1/patients/:patientId` | 환자 상세 (프로필 + 시술기록 + 이용권 + 발급된 인증코드 이력) |
| PATCH | `/api/v1/patients/:patientId` | 환자 프로필 수정 |
| POST | `/api/v1/patients/:patientId/care-records` | 시술 기록 추가 |
| DELETE | `/api/v1/care-records/:careRecordId` | 시술 기록 삭제 |
| POST | `/api/v1/patients/:patientId/memberships` | 이용권 추가 |
| DELETE | `/api/v1/memberships/:membershipId` | 이용권 삭제 |
| POST | `/api/v1/patients/:patientId/signup-code` | 가입 인증코드 발급 (24시간 유효) |

## 미확정/후속 과제

- claim 이후 지속적인 EMR↔앱 DB 동기화(ETL) — 이번 범위 밖, `docs/db-schema.html`의 "클리닉 EMR 연동" 절 참고
- admin-web 자체 로그인/권한 분리
- `phone`은 `profiles.phone`에 unique 제약이 있어, 서로 다른 환자가 같은 전화번호(가족 공유 등)로 각각 claim하면
  두 번째 claim은 실패한다 — 이번 범위에서는 해결하지 않음(알려진 한계)
