# WHS After Mate — Admin Server

`admin-web`(관리자 홈페이지)이 호출하는 백엔드. 실제 클리닉 데스크가 환자를 접수하듯,
**아직 앱 계정이 없는 환자의 이름·생년월일·전화번호·시술 이력·이용권을 먼저 입력**해두는 가상 EMR 데이터 입력 도구다.

전체 API 명세(요청/응답, 에러 코드, 클리닉 데이터 격리 정책)는 [`docs/admin-api-spec.md`](../docs/admin-api-spec.md) / `.html` 참고 — 아래는 요약이다.

## `server/`와의 관계

- **같은 Supabase 프로젝트**를 공유한다 — `.env`의 `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`는 `server/.env`와 동일한 값이어야 한다.
- 여기서 쓰는 `emr_patients`/`emr_care_records`/`emr_memberships` 3개 테이블은 `auth.users`와 **무관하게 독립적으로 존재**한다
  (마이그레이션 `006_add_admin_emr_staging_tables.sql` + 이후 `007`~`012`로 조정됨). 별도 관리자 로그인 계정
  테이블 `admin_accounts`(마이그레이션 `008`)도 이 리포에 속한다.
- 환자가 실제로 앱에 가입할 때(`POST /auth/signup` — `server/`), **환자번호(patientNo) + 이름 + 생년월일**이
  emr_patients 레코드와 정확히 일치하면 그 순간 이 스테이징 테이블의 데이터가
  `profiles`/`medical_profiles`/`care_records`/`memberships`로 **1회성 이관(claim)**된다. 인증코드 발급 절차는 없다.
  이관 이후에도(재방문 등) 시술기록 추가는 계속 가능하다 — 다만 그 이후 기록은 스테이징 테이블(`emr_*`)이 아니라
  실제 앱 테이블(`care_records`/`memberships`)에 곧바로 쌓인다. 어느 쪽에 기록됐는지는 `POST .../care-records`와
  `GET /patients/:patientId` 응답의 `source`(`"emr"`|`"app"`) 필드로 구분한다.

## 설정

```bash
cp .env.example .env   # SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY를 server/.env와 동일하게, ADMIN_JWT_SECRET은 임의의 긴 문자열로 채운다
npm install
npm run dev             # 기본 포트 4100
npm run seed:admins     # 클리닉 3계정(amred/derna/wim) 생성 — 최초 1회
```

마이그레이션 006~012가 아직 Supabase에 적용 안 됐다면 SQL Editor에서 순서대로 실행해야 한다(001~005와 동일한 방식).

## 로그인

클리닉(브랜드)당 계정 1개, 총 3개(`amred`/`derna`/`wim`)로 고정. `POST /auth/login`만 공개돼 있고
나머지 엔드포인트는 전부 `Authorization: Bearer <token>` 필수다. 로그인한 계정의 `brand`가
환자 등록·시술기록 추가 시 자동으로 기록되고, 조회도 그 브랜드로 격리된다(다른 클리닉 데이터는 `404`).
데모 단계라 계정 생성 API는 없고 `npm run seed:admins`로만 만든다.

## 엔드포인트

| Method | Path | 설명 |
|---|---|---|
| POST | `/api/v1/auth/login` | 클리닉 관리자 로그인 (유일하게 인증 불필요) |
| GET | `/api/v1/care-types` | 시술기록 추가 시 고를 수 있는 careType 목록 (reference_guides에 검수 등록된 값만) |
| GET | `/api/v1/body-parts` | 시술기록 추가 시 고를 수 있는 관리 부위 목록 (중복 선택 가능, 23개 고정) |
| POST | `/api/v1/patients` | 환자 등록 (이름/생년월일/전화번호 + 선택: 기타사항) → 환자번호만 발급. 같은 클리닉에 이름+생년월일+전화번호가 일치하는 환자가 이미 있으면 새로 만들지 않고 재사용(기타사항은 다르면 갱신) 후 `200`+`duplicate: true` |
| GET | `/api/v1/patients?search=` | 환자 목록/검색 (로그인한 클리닉 소유 환자만, 이름·전화번호·환자번호 부분일치) |
| GET | `/api/v1/patients/:patientId` | 환자 상세 (프로필 + 시술기록 + 이용권, claim 여부와 무관하게 항상 기록 가능) |
| PATCH | `/api/v1/patients/:patientId` | 환자 프로필 수정 |
| POST | `/api/v1/patients/:patientId/care-records` | 시술 기록 추가 — `membershipId`(기존 이용권 차감) 또는 `totalSessions`(직접 입력, 새 이용권 생성) 중 하나. claim 여부에 따라 스테이징(`emr_*`) 또는 실제 앱 테이블에 기록 |
| DELETE | `/api/v1/care-records/:careRecordId` | 시술 기록 삭제 — 연결된 이용권도 함께 정리(유일 참조면 이용권 삭제, 아니면 `used_count` -1). 별도 "이용권 삭제" API는 없음 |
| GET | `/api/v1/visit-stats` | 전날/금일(KST) 방문 + 익일 예약 고객 수 (중복 제거) |

## 미확정/후속 과제

- 회원가입(claim) 이후엔 시술기록 추가가 실제 앱 테이블(`care_records`/`memberships`)로 곧바로 쌓이므로 지속적인
  ETL은 필요 없어졌다. 다만 claim **시점**의 1회성 이관 자체는(그 이전 `emr_*` 기록을 앱 테이블로 복사) 여전히
  존재하고, 그로 인해 `GET /patients/:patientId`에서 claim 이전 기록이 `source: "emr"`(원본)/`"app"`(이관 복사본)
  양쪽에 중복으로 보이는 현상이 있다 — `docs/admin-api-spec.md`의 해당 절 참고
- `phone`은 `profiles.phone`에 unique 제약이 있어, 서로 다른 환자가 같은 전화번호(가족 공유 등)로 각각 claim하면
  두 번째 claim은 실패한다 — 이번 범위에서는 해결하지 않음(알려진 한계)
- patientNo+이름+생년월일 조합은 인증코드보다 추측하기 쉬움(제3자가 환자 이름/생년월일을 알면 가입 가능) — 데모 범위의
  트레이드오프로 채택됨, 실서비스 전환 시 재검토 필요
- 이용권(`memberships`)은 클리닉별로 격리되지 않는다 — 회원가입한 고객의 이용권은 어느 클리닉에서 만들었든 전부
  조회·차감 대상에 뜬다(실제 `memberships` 테이블에 `brand` 컬럼 자체가 없음)
