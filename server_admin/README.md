# WHS After Mate — Admin Server

`admin-web`(관리자 홈페이지)이 호출하는 백엔드. 실제 클리닉 데스크가 환자를 접수하듯,
**아직 앱 계정이 없는 환자의 이름·생년월일·전화번호·시술 이력·이용권을 먼저 입력**해두는 가상 EMR 데이터 입력 도구다.

전체 API 명세(요청/응답, 에러 코드, 클리닉 데이터 격리 정책)는 [`docs/admin-api-spec.md`](../docs/admin-api-spec.md) / `.html` 참고 — 아래는 요약이다.

## `server/`와의 관계

- **같은 Supabase 프로젝트**를 공유한다 — `.env`의 `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`는 `server/.env`와 동일한 값이어야 한다.
- 여기서 쓰는 `emr_patients`/`emr_care_records`/`emr_memberships` 3개 테이블은 `auth.users`와 **무관하게 독립적으로 존재**한다
  (마이그레이션 `006_add_admin_emr_staging_tables.sql` + 이후 `007`~`012`, `025`로 조정됨). 별도 관리자 로그인 계정
  테이블 `admin_accounts`(마이그레이션 `008`)도 이 리포에 속한다. 치료-부위 카탈로그 `treatment_catalog`
  (마이그레이션 `013`, `021`~`024`로 개편)는 이제 **클리닉별로 분리된** 참조 테이블이다(v0.10 이전엔 클리닉 공통) —
  어떤 계정/환자 테이블과도 FK로 연결되지 않는 건 동일.
- **FCM 푸시** `(v0.10)` — `POST .../care-records`가 예약(미래 날짜) 등록 즉시 `src/services/push.service.ts`로
  알림을 보낸다(`src/config/firebase.ts`, `server/`와는 별도의 자체 FCM 설정). `notification_log`(고객용 `server/`와
  공유하는 테이블)로 중복 발송을 막는다.
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

마이그레이션 006~026이 아직 Supabase에 적용 안 됐다면 SQL Editor에서 순서대로 실행해야 한다(001~005와 동일한 방식). `026`(`care_records`/`emr_care_records.session_consumed` 추가)까지 전부 적용 완료 확인됨.

## 로그인

클리닉(브랜드)당 계정 1개, 총 3개(`amred`/`derna`/`wim`)로 고정. `POST /auth/login`만 공개돼 있고
나머지 엔드포인트는 전부 `Authorization: Bearer <token>` 필수다. 로그인한 계정의 `brand`가
환자 등록·시술기록 추가 시 자동으로 기록되고, 조회도 그 브랜드로 격리된다(다른 클리닉 데이터는 `404`).
데모 단계라 계정 생성 API는 없고 `npm run seed:admins`로만 만든다.

## 엔드포인트

| Method | Path | 설명 |
|---|---|---|
| POST | `/api/v1/auth/login` | 클리닉 관리자 로그인 (유일하게 인증 불필요) |
| GET | `/api/v1/body-parts` | 시술기록 추가 시 고를 수 있는 관리 부위 목록 (중복 선택 가능, 23개 고정, 어떤 치료를 골랐든 항상 동일) |
| POST | `/api/v1/patients` | 환자 등록 (이름/생년월일/전화번호 + 선택: 기타사항) → 환자번호만 발급. 같은 클리닉에 이름+생년월일+전화번호가 일치하는 환자가 이미 있으면 새로 만들지 않고 재사용(기타사항은 다르면 갱신) 후 `200`+`duplicate: true`. `(v0.11)` 이름/생년월일이 다른 **다른 환자**가 이미 이 전화번호를 쓰고 있으면 `409 PHONE_ALREADY_REGISTERED`로 등록 자체 차단(같은 사람의 다른 클리닉 등록은 예외) |
| GET | `/api/v1/patients?search=` | 환자 목록/검색 (로그인한 클리닉 소유 환자만, 이름·전화번호·환자번호 부분일치) |
| GET | `/api/v1/patients/:patientId` | 환자 상세 (프로필 + 시술기록 + 이용권, claim 여부와 무관하게 항상 기록 가능) |
| PATCH | `/api/v1/patients/:patientId` | 환자 프로필 수정 |
| POST | `/api/v1/patients/:patientId/care-records` | 시술 기록 추가 — `membershipId`(기존 이용권에서 사용) 또는 `totalSessions`(직접 입력, 같은 치료명+같은 횟수권으로 아직 유효한 이용권이 있으면 이어서 사용, 없으면 새로 생성). claim 여부에 따라 스테이징(`emr_*`) 또는 실제 앱 테이블에 기록. `careType` 필드는 완전히 없어짐(v0.10). **`(v0.11)` `careDate`가 오늘(KST)일 때만 이용권을 실제로 차감한다** — 미래 예약/과거 소급 등록은 이용권 연결만 하고 `used_count`는 안 건드림(`careRecord.session_consumed`로 구분). 같은 이용권을 참조하는 미소비 예약들의 `session_number`는 차감/차감취소가 생길 때마다 자동 재계산됨. 예약(미래 날짜) 등록 시 FCM 푸시 발송 |
| DELETE | `/api/v1/care-records/:careRecordId` | 시술 기록 삭제 — 연결된 이용권도 함께 정리(유일 참조면 이용권 삭제, 아니면 `used_count` -1). 별도 "이용권 삭제" API는 없음 |
| GET | `/api/v1/visit-stats` | 전날/금일(KST) 방문 + 익일 예약 고객 수 (중복 제거) |
| GET | `/api/v1/reservations?date=` | 특정 날짜(미지정 시 오늘)의 예약 목록(`careRecordId`+환자명+전화번호). 취소는 별도 API 없이 이 목록에서 얻은 `careRecordId`로 기존 `DELETE /care-records/:careRecordId`를 그대로 호출 |
| GET | `/api/v1/treatment-catalog?search=` | 로그인 클리닉의 치료-부위 카탈로그 목록/검색 `(v0.10, 브랜드로 격리됨 — v0.9까지는 클리닉 공통)`. `description`(시술 설명) 필드 포함 |
| POST/PATCH/DELETE | `/api/v1/treatment-catalog[/:treatmentId]` | 치료-부위 카탈로그 등록/수정/삭제 — 치료명→관리 부위/설명 매핑(`careType` 없음, v0.10). `(v0.11)` `PATCH`/`DELETE`도 `GET`/`POST`와 동일하게 브랜드로 격리됨(다른 클리닉 소유 항목은 `404`) |
| GET | `/api/v1/clinic-info` | 로그인 클리닉의 카카오톡/전화번호(고객용 `server/`의 `businesses` 테이블 재사용) + 담당 의료진 목록(`clinic_doctors`, 시드로만 생성) |

## 미확정/후속 과제

- 회원가입(claim) 이후엔 시술기록 추가가 실제 앱 테이블(`care_records`/`memberships`)로 곧바로 쌓이므로 지속적인
  ETL은 필요 없어졌다. 다만 claim **시점**의 1회성 이관 자체는(그 이전 `emr_*` 기록을 앱 테이블로 복사) 여전히
  존재하고, 그로 인해 `GET /patients/:patientId`에서 claim 이전 기록이 `source: "emr"`(원본)/`"app"`(이관 복사본)
  양쪽에 중복으로 보이는 현상이 있다 — `docs/admin-api-spec.md`의 해당 절 참고
- `phone`은 `profiles.phone`에 unique 제약이 있어, 서로 다른 환자가 같은 전화번호(가족 공유 등)로 각각 claim하면
  두 번째 claim은 실패한다. `(v0.11)` **환자 등록 시점에 미리 차단하도록 완화됨** — `POST /patients`가 이름/생년월일이
  다른 다른 환자와 전화번호가 겹치면 `409 PHONE_ALREADY_REGISTERED`로 등록 자체를 막아서, "둘 다 등록은 됐는데
  나중에 가입할 때만 원인 모를 500으로 막히는" 사고는 예방된다. 다만 두 환자가 **이미 등록된 상태**에서 이 기능이
  나중에 배포된 경우처럼, 등록 시점을 지나친 기존 데이터에 대해서는 여전히 같은 문제가 남아있을 수 있음
- patientNo+이름+생년월일 조합은 인증코드보다 추측하기 쉬움(제3자가 환자 이름/생년월일을 알면 가입 가능) — 데모 범위의
  트레이드오프로 채택됨, 실서비스 전환 시 재검토 필요
- 이용권(`memberships`)은 클리닉별로 격리되지 않는다 — 회원가입한 고객의 이용권은 어느 클리닉에서 만들었든 전부
  조회·차감 대상에 뜬다(실제 `memberships` 테이블에 `brand` 컬럼 자체가 없음)
- **`careName` 표기가 고객용 `server/`의 `treatment_guides`와 정확히 일치해야 daily-guide가 뜬다** (v0.10) —
  `care_type`이라는 완충 개념이 완전히 없어지고(컬럼 자체가 삭제됨) 시술명 직접 매칭으로 바뀌면서, 오타·표기
  불일치가 있으면 시술기록 자체는 정상 등록되지만 그 기록의 고객용 `/aftercare/daily-guide`는 항상 404
  `GUIDE_NOT_AVAILABLE`로 실패한다. `partOfBody`(관리 부위)는 이 문제와 무관 — 카탈로그와 무관한 고정 목록에서
  자유 선택
- ~~`PATCH`/`DELETE /treatment-catalog/:treatmentId`가 브랜드 소유권을 검증하지 않음~~ — **v0.11에서 해소됨**
- **이용권 만료일은 재계산되지 않는다** — 자동 이어쓰기로 기존 이용권을 계속 써도 `expires_at`은 최초 생성 시점
  값 그대로 유지된다("이어서 쓰면 만료일도 연장"은 이번 범위 밖)
- **이용권 자동 이어쓰기 매칭이 정확히 일치할 때만 동작** — `product_name`+`total_count`가 완전히 같아야 이어서
  사용된다. 치료명 표기가 조금만 달라도(오타, 띄어쓰기 등) 별개 이용권으로 취급돼 새로 생성됨 — 관리자가 카탈로그에서
  치료명을 골라 입력하게 하면 표기 불일치를 줄일 수 있음(프론트 구현 필요)
- **`(v0.11)` 예약(미차감) 등록이 실제 시술이 있었는지를 검증하지 않는다** — `careDate`가 오늘이 아니면 무조건
  "예약"으로 취급해 차감을 건너뛴다. 과거 날짜로 소급 등록하는 경우(예: 어제 시술을 오늘 깜빡하고 입력)도 똑같이
  미차감 처리되는데, 이건 실제로 이미 받은 시술이라 차감하는 게 더 맞을 수 있다 — 현재는 "오늘이 아니면 미차감"으로
  단순화돼 있어 과거 소급 등록과 미래 예약을 구분하지 않음(사용자 확인 후 결정 필요, 이월)
