# WHS After Mate — 관리자 API 명세서 (server_admin, v0.2)

기준 프로젝트: Manyfast "WHS After Mate". 이 문서는 `admin-web`(관리자 웹, 별도 GitHub 저장소)이 호출하는 **`server_admin`**(포트 4100, 이 리포 소속)의 API를 다룬다. 고객용 `server/` API는 `api-spec.md` 참고 — 두 서버는 같은 Supabase 프로젝트를 공유하지만 서로 다른 서버 프로세스이고, 이 문서의 범위는 `server_admin`으로 한정된다.

v0.2 변경: 관리자 웹 대시보드 프로토타입(`docs/WHS_After_Mate_Admin_revised.html`) 검토 결과 `GET /visit-stats`를 "오늘/어제/이틀 전"에서 "전날/금일 방문 + 익일 예약"으로 변경. "익일 예약"은 별도 예약 테이블 없이 기존 시술기록 API(`careDate`가 원래 미래 날짜를 막지 않음)를 그대로 재사용한다 — 자세한 내용은 하단 "3. 통계" 절 참고. 예약 취소 기능은 아직 범위 밖(추후 고객용 앱과 연동해 별도 구현 예정).

`server_admin`은 "실제 클리닉 데스크가 환자를 접수하듯, 아직 앱 계정이 없는 환자의 이름·생년월일·전화번호·시술 이력·이용권을 먼저 입력"해두는 가상 EMR 데이터 입력 도구다. 여기서 등록한 데이터는 환자가 실제로 앱에 회원가입(`POST /auth/signup` — `server/`)하는 순간 실제 앱 DB로 이관(claim)된다. 회원가입 이후 그 환자가 재방문해도 시술기록 추가는 계속 가능하다 — 다만 그 이후 기록은 스테이징 테이블(`emr_*`)이 아니라 실제 앱 테이블(`care_records`/`memberships`)에 곧바로 쌓인다(2절 참고).

- Base URL: `/api/v1`
- 인증: `Authorization: Bearer {token}` — **`POST /auth/login` 하나만 예외**, 그 외 모든 엔드포인트에 필수
- 포맷: `application/json`, 날짜는 `YYYY-MM-DD`
- 공통 에러 형식:
```json
{ "error": { "code": "STRING_CODE", "message": "사용자에게 보여줄 메시지" } }
```
  - 라우트 자체가 없으면 `404 NOT_FOUND`
  - 요청 형식 위반(zod 검증 실패)이면 `400 VALIDATION_ERROR`
  - 그 외 처리되지 않은 서버 오류는 `500 INTERNAL_ERROR`(상세는 서버 로그에만 남고 응답 메시지는 일반화됨)

---

## 엔드포인트 전체 요약

| Method | Path | 인증 | 설명 |
|---|---|---|---|
| POST | `/auth/login` | 불필요 | 클리닉 관리자 로그인 |
| GET | `/care-types` | 필요 | 시술기록 추가 시 고를 수 있는 careType 목록 |
| GET | `/body-parts` | 필요 | 시술기록 추가 시 고를 수 있는 관리 부위 목록(중복 선택) |
| POST | `/patients` | 필요 | 환자 등록 (환자번호 발급, 이름+생년월일+전화번호 중복 시 기존 환자 재사용 후 200) |
| GET | `/patients?search=` | 필요 | 환자 목록/검색 (로그인 클리닉만) |
| GET | `/patients/{patientId}` | 필요 | 환자 상세 (프로필+시술기록+이용권) |
| PATCH | `/patients/{patientId}` | 필요 | 환자 프로필 수정 |
| POST | `/patients/{patientId}/care-records` | 필요 | 시술기록 추가 (이용권 처리 포함, 회원가입 여부 무관) |
| DELETE | `/care-records/{careRecordId}` | 필요 | 시술기록 삭제 (이용권 정리 포함) |
| GET | `/visit-stats` | 필요 | 전날/금일 방문 + 익일 예약 고객 수 |

별도의 "이용권 추가"·"이용권 삭제" 엔드포인트는 없다 — 이용권은 시술기록 추가·삭제에 묶여서만 생성·정리된다(아래 2절 참고).

---

## 0. 로그인

클리닉(브랜드)당 계정 1개, 총 3개(`amred`/`derna`/`wim`)로 고정. 가입 API는 없고 `server_admin/db/seed/seedAdmins.ts`(`npm run seed:admins`)로만 생성한다. 로그인한 계정의 `brand`가 이후 모든 요청에서 자동 적용되는 격리 기준이 된다(아래 "클리닉 데이터 격리" 참고).

### POST /auth/login

**Request**
```json
{ "username": "amred", "password": "amred1234" }
```
| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `username` | string | required | |
| `password` | string | required | |

**DB**: `admin_accounts` **SELECT** (`username`으로 1행 조회) — `password_hash`(bcrypt 비교용), `brand`(토큰에 실어 이후 요청의 격리 기준으로 씀)

**Response 200**
```json
{ "token": "eyJhbGciOi...", "username": "amred", "brand": "AMRED CLINIC" }
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `token` | string | JWT. 이후 모든 요청의 `Authorization: Bearer` 헤더에 그대로 넣어서 씀 |
| `username` | string | 로그인한 관리자 아이디 |
| `brand` | string | 소속 클리닉명. 화면 상단에 "현재 로그인 클리닉" 표시 등에 사용 |

`token`은 유효기간 12시간, 만료돼도 별도 에러코드 없이 다른 401과 동일하게 처리된다(아래 참고).

**에러**
| status/code | 상황 |
|---|---|
| `401 INVALID_CREDENTIALS` | 아이디 없음 또는 비밀번호 불일치 |

### 로그인 이후 모든 요청 공통

`Authorization: Bearer <token>` 헤더가 없거나, 토큰이 잘못됐거나(서명 불일치·만료·형식 오류 전부 동일하게 처리), 파싱에 실패하면:

| status/code | 상황 |
|---|---|
| `401 UNAUTHORIZED` | 토큰 없음/만료/무효 (원인 구분 없이 동일 코드) |

---

## 1. 환자

### GET /care-types
`careType`은 관리자가 자유 입력하는 값이 아니라, 전문가 검수를 거쳐 `reference_guides`에 실제로 등록된 카테고리 중에서만 고를 수 있다(그래야 고객용 `/aftercare/daily-guide`가 항상 응답 가능함이 보장됨). 이 목록은 클리닉 공통 자료라 브랜드 격리 대상이 아니다.

**DB**: `reference_guides` **SELECT** — `care_type` 컬럼만 조회해서 중복 제거(`Set`) 후 정렬. `brand` 조건 없이 테이블 전체 대상(공용 자료라서).

**Response 200**
```json
{ "careTypes": ["laser_toning", "peeling"] }
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `careTypes` | string[] | D 화면 careType select에 그대로 뿌릴 선택 가능 값 목록 |

현재 검수 등록된 값은 `peeling`/`laser_toning` 2개뿐 — 리프팅류(울쎄라 등)는 아직 검수된 가이드가 없어 이 목록에 없다.

### GET /body-parts
관리 상세 화면(와이어프레임 11번)처럼 한 시술이 여러 부위에 동시에 해당할 수 있어, 시술기록의 관리 부위는 중복 선택 가능한 배열이다. `reference_guides`처럼 검수 테이블은 아니고 고정된 신체 부위 분류 상수라 브랜드 격리 대상도 아니다.

**DB**: 없음 — DB를 전혀 조회하지 않는다. `server_admin/src/lib/bodyParts.ts`에 하드코딩된 `BODY_PARTS` 상수 배열을 그대로 반환할 뿐이다(그래서 `care-types`와 달리 응답이 항상 고정).

**Response 200**
```json
{ "bodyParts": ["얼굴 전체", "이마", "미간", "관자", "눈가", "눈밑", "코", "볼", "앞볼", "심부볼", "팔자", "입가", "입술", "턱", "턱선", "이중턱", "목", "데콜테", "팔", "복부", "허벅지", "종아리", "기타"] }
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `bodyParts` | string[] | D 화면 관리 부위 체크박스에 그대로 뿌릴 선택 가능 값 목록(23개 고정) |

### POST /patients
실제 클리닉 데스크에서 환자가 처음 방문했을 때 입력하는 정보. 성공하면 환자번호(`patientNo`)만 발급한다 — **인증코드는 없음**. 회원가입(`POST /auth/signup` — `server/`)은 이 환자번호+이름+생년월일이 정확히 일치해야 진행된다.

**Request**
```json
{ "name": "홍길동", "birthDate": "1990-05-20", "phone": "01012345678", "notes": "페니실린 알러지" }
```
| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `name` | string | required | |
| `birthDate` | string | required | `YYYY-MM-DD` |
| `phone` | string | required | 숫자만 9~11자리, 하이픈 없음 |
| `notes` | string | optional | 기타사항 — 알러지·기저질환·의사소견을 한 칸에 통합 |

`brand`는 요청에 없다 — 로그인한 관리자 계정에서 그대로 기록된다(수동 선택 시 실수로 다른 클리닉을 고를 여지를 없앰).

같은 클리닉에 `name`+`birthDate`+`phone`이 전부 일치하는 환자가 이미 있으면 **새로 만들지 않고 그 환자를 그대로 재사용**한다(접수 직원의 실수 중복 등록 방지). 이때 `notes`가 기존 값과 다르면(재방문 사이 알러지 등이 바뀌었을 수 있으므로) 그 자리에서 새 값으로 갱신한다. 앱 회원가입(claim) 여부는 이 판단과 무관 — `emr_patients`에 있는지만 본다. 다른 클리닉에 같은 사람이 등록돼 있어도 이 판단에 영향을 주지 않는다(클리닉 데이터 격리 원칙 — 다른 클리닉 데이터의 존재를 알려주지 않음).

**DB**: `emr_patients` **SELECT** (`brand`+`name`+`birth_date`+`phone` 전부 일치하는 행 확인) → 있으면 `notes`가 다를 때만 **UPDATE**(`notes`, `updated_at`) 후 그 행을 반환하고 종료(아래 "중복 시" 참고). 없으면 **INSERT** — `patient_no`(서버가 자동 생성), `name`, `birth_date`, `phone`, `notes`, `brand`(토큰에서 가져옴). `patient_no` unique 충돌(`23505`) 시 새 번호로 최대 5회 재시도.

**Response 201** — 새로 등록된 경우, `emr_patients` 행 그대로(스네이크 케이스)
```json
{
  "id": "uuid",
  "patient_no": "EMR-P-A1B2C3",
  "name": "홍길동",
  "birth_date": "1990-05-20",
  "phone": "01012345678",
  "notes": "페니실린 알러지",
  "brand": "AMRED CLINIC",
  "claimed_user_id": null,
  "claimed_at": null,
  "created_at": "2026-08-15T09:00:00Z",
  "updated_at": "2026-08-15T09:00:00Z"
}
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `id` | string(uuid) | 환자 내부 식별자 — 아래 "현재 대상 환자" patientId, 즉 C~E 요청의 경로 파라미터로 계속 씀. `patient_no`와 다름에 주의 |
| `patient_no` | string | `EMR-P-XXXXXX` 형태 환자번호. 서버가 자동 발급(충돌 시 최대 5회 재시도), 회원가입(`server/` `/auth/signup`)에서 씀 |
| `name` | string | |
| `birth_date` | string | `YYYY-MM-DD` |
| `phone` | string | |
| `notes` | string \| null | 기타사항 |
| `brand` | string | 소속 클리닉(로그인 계정에서 자동 기록) |
| `claimed_user_id` | string(uuid) \| null | 회원가입(claim) 완료 시 연결된 실제 앱 계정 id. 미가입이면 `null` — 이 값으로 "가입 여부"를 판단하면 됨 |
| `claimed_at` | string \| null | 회원가입 완료 시각. 미가입이면 `null` |
| `created_at` | string | 환자 등록 시각(ISO 8601) |
| `updated_at` | string | 마지막 수정 시각 |

이 응답 형태는 아래 `PATCH /patients/{patientId}`의 Response와 완전히 동일하다.

**Response 200 — 중복(이미 등록된 환자)인 경우.** 새로 만든 게 아니라 기존 환자를 재사용했다는 뜻이라 `201`이 아니라 `200`으로 응답하고, 위 필드에 두 개가 추가된다:
```json
{
  "id": "uuid",
  "patient_no": "EMR-P-A1B2C3",
  "name": "홍길동",
  "birth_date": "1990-05-20",
  "phone": "01012345678",
  "notes": "페니실린 알러지 (2026-08-16 갱신: 새우 알러지 추가)",
  "brand": "AMRED CLINIC",
  "claimed_user_id": null,
  "claimed_at": null,
  "created_at": "2026-08-15T09:00:00Z",
  "updated_at": "2026-08-16T02:00:00Z",
  "duplicate": true,
  "message": "이미 등록된 환자입니다. 기존 환자 정보를 불러왔습니다."
}
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `duplicate` | boolean | 항상 `true`. 이 응답이 신규 등록이 아니라 기존 환자 매칭임을 알려주는 파생 필드 — 프론트에서 "환자를 새로 만들었어요" 대신 "이미 등록된 환자예요" 안내를 띄울 때 이 값으로 분기 |
| `message` | string | 화면에 그대로 띄워도 되는 안내 문구 |
| 그 외 필드 | — | 위 201 응답과 동일. `notes`는 요청에 새 값을 보냈다면 그 값으로 이미 갱신된 상태, `updated_at`도 함께 갱신됨(요청 `notes`가 기존과 같았다면 갱신 자체가 일어나지 않아 `updated_at`도 그대로) |

### GET /patients?search=
로그인한 클리닉이 등록한 환자만 나온다 — 다른 클리닉 환자는 검색해도 절대 나오지 않는다.

**Query**: `search` (optional) — 이름·전화번호·환자번호 부분일치, 생략 시 전체 목록

**DB**
- `emr_patients` **SELECT** (`brand`=로그인 클리닉, `search` 있으면 `name`/`phone`/`patient_no`에 `ilike` OR 조건 추가) — `id`, `patient_no`, `name`, `birth_date`, `phone`, `brand`, `claimed_user_id`, `claimed_at`, `created_at`
- `emr_care_records` **SELECT** (위에서 찾은 `patient_id` 목록으로 `in` 조회) — `patient_id`, `care_name`, `care_date`, `created_at`
- 목록에 회원가입(claim) 완료된 환자가 있으면, 그 `claimed_user_id` 목록으로 `care_records` **SELECT** (`brand`=로그인 클리닉)도 추가 조회 — `user_id`, `care_name`, `care_date`, `created_at`
- 위 두 결과를 환자별로 합쳐서 `care_date`가 가장 최신인 것(같은 날짜면 `created_at`이 더 늦은 것)을 `latestCareName`으로 계산(DB 집계 아니라 서버 코드에서 계산) — 그래야 회원가입 후 재방문한 기록도 반영됨

**Response 200**
```json
{
  "patients": [
    {
      "id": "uuid",
      "patient_no": "EMR-P-A1B2C3",
      "name": "홍길동",
      "birth_date": "1990-05-20",
      "phone": "01012345678",
      "brand": "AMRED CLINIC",
      "claimed_user_id": null,
      "claimed_at": null,
      "created_at": "2026-08-15T09:00:00Z",
      "latestCareName": "울쎄라 300샷"
    }
  ]
}
```
`patients` 배열의 각 항목 필드:

| 필드 | 타입 | 설명 |
|---|---|---|
| `id` | string(uuid) | |
| `patient_no` | string | |
| `name` | string | |
| `birth_date` | string | |
| `phone` | string | |
| `brand` | string | |
| `claimed_user_id` | string(uuid) \| null | |
| `claimed_at` | string \| null | |
| `created_at` | string | |
| `latestCareName` | string \| null | camelCase, 서버가 계산해 붙이는 파생 필드. 이 환자의 가장 최근 시술명, 없으면 `null` — 목록 화면에서 빈 칸으로 표시 |

⚠️ **주의**: 이 목록 항목엔 `notes`/`updated_at`이 없다 — `POST /patients`·`GET /patients/{patientId}` 응답(전체 컬럼)과 다른, 목록 전용으로 줄인 컬럼 집합이다. `notes`가 필요하면 `GET /patients/{patientId}`를 따로 호출해야 한다.

### GET /patients/{patientId}
프로필 + 시술기록 + 이용권을 한 번에 반환한다. 회원가입(claim) 완료된 환자면 회원가입 이후 실제 앱에
쌓인 시술기록/이용권까지 합쳐서 보여준다 — 그래야 D 화면의 "이용권 선택"에 재방문 이후 생긴 이용권도 뜬다.

**DB**
- `emr_patients` **SELECT** `*` (`id`로 조회 후 `brand` 일치 확인)
- `emr_care_records` **SELECT** `*` (`patient_id`로 필터)
- `emr_memberships` **SELECT** `*` (`patient_id`로 필터)
- **환자가 회원가입(claim) 완료된 상태면 추가로:**
  - `care_records` **SELECT** `*` (`user_id`=`claimed_user_id`, `brand`=로그인 클리닉으로 필터 — 이 클리닉에서의 방문분만)
  - `memberships` **SELECT** `*` (`user_id`=`claimed_user_id` — 이 테이블엔 `brand` 컬럼이 없어 다른 클리닉에서 산 이용권까지 전부 나옴, 아래 참고)
- 위에서 모은 시술기록/이용권을 각각 하나의 배열로 합쳐(`emr_*` + 앱 쪽) `care_date`/`created_at` 최신순으로 정렬

**Response 200**
```json
{
  "patient": { "...emr_patients 전체 컬럼": "..." },
  "careRecords": [ { "...emr_care_records 또는 care_records 전체 컬럼 + source": "..." } ],
  "memberships": [ { "...emr_memberships 또는 memberships 전체 컬럼 + source": "..." } ]
}
```
- `patient`: 위 `POST /patients` Response와 완전히 동일한 필드 구성(`id`/`patient_no`/`name`/`birth_date`/`phone`/`notes`/`brand`/`claimed_user_id`/`claimed_at`/`created_at`/`updated_at`)
- `careRecords`(배열, 최신순) 각 항목 — 스테이징(`emr_care_records`)이면 `patient_id`, 실제 앱(`care_records`)이면 `user_id`를 갖는다(둘 중 하나만 존재):

| 필드 | 타입 | 설명 |
|---|---|---|
| `id` | string(uuid) | 시술기록 id — 삭제 시 경로 파라미터로 씀 |
| `source` | `"emr"` \| `"app"` | 서버가 붙이는 파생 필드. `"emr"`=회원가입 전 스테이징, `"app"`=실제 앱 테이블(회원가입 후 방문분) |
| `patient_id` | string(uuid) | `source: "emr"`일 때만 존재 |
| `user_id` | string(uuid) | `source: "app"`일 때만 존재 |
| `care_name` | string | 관리명 |
| `care_type` | string | `GET /care-types` 값 중 하나 |
| `care_date` | string | `YYYY-MM-DD` |
| `part_of_body` | string[] | 관리 부위(중복 선택된 값들) |
| `brand` | string | |
| `practitioner` | string \| null | 시술한 의사 이름 |
| `basic_aftercare_guide` | string[] | |
| `doctor_comment` | string \| null | |
| `session_number` | number | 이 시술이 이용권의 몇 회차였는지 |
| `total_sessions` | number | 그 이용권의 총 횟수 |
| `membership_id` | string(uuid) \| null | 이 시술이 소비한 이용권 id — 아래 `memberships` 배열의 `id`와 매칭됨(같은 `source` 안에서만 매칭됨에 주의) |
| `created_at` | string | |

- `memberships`(배열, 최신순) 각 항목 — `careRecords`와 동일하게 `source`로 구분, `patient_id`/`user_id` 중 하나만 존재:

| 필드 | 타입 | 설명 |
|---|---|---|
| `id` | string(uuid) | 이용권 id — D 화면 "이용권 선택"의 값, 삭제 시 참조되는 id |
| `source` | `"emr"` \| `"app"` | 위와 동일 |
| `patient_id` | string(uuid) | `source: "emr"`일 때만 |
| `user_id` | string(uuid) | `source: "app"`일 때만 |
| `product_name` | string | 이용권 상품명 |
| `total_count` | number | 총 횟수 |
| `used_count` | number | 사용한 횟수 |
| `remaining_count` | number | 생성 컬럼(`total_count - used_count`) — "N회 남음" 표시에 바로 씀 |
| `expires_at` | string \| null | |
| `last_used_at` | string \| null | |
| `available_care_names` | string[] | |
| `created_at` | string | |

⚠️ **주의(회원가입 이관 중복)**: 회원가입 시 그때까지의 `emr_care_records`/`emr_memberships`가 `care_records`/`memberships`로 복사된다(1회성 이관, `server/`의 `signup()`). 그래서 회원가입한 환자는 가입 **이전** 시술기록이 `source: "emr"`(원본, 스테이징에 그대로 남음)과 `source: "app"`(이관된 복사본) 양쪽에 한 번씩 나타난다 — 같은 시술이 중복으로 보이는 게 아니라 "원본/이관 복사본"이 둘 다 보이는 것이니 프론트에서 참고.

**에러**
| status/code | 상황 |
|---|---|
| `404 PATIENT_NOT_FOUND` | 존재하지 않거나, 존재해도 다른 클리닉 소유(**의도적으로 403이 아니라 404** — 다른 클리닉 데이터의 존재 자체를 숨김) |

### PATCH /patients/{patientId}
부분 수정 — 보낸 필드만 반영된다.

**DB**: `emr_patients` **SELECT** `*` (존재+`brand` 확인) → **UPDATE** (`name`/`birth_date`/`phone`/`notes` 중 요청에 있는 것만 + `updated_at`)

**Request** (모두 optional)
```json
{ "name": "홍길동", "birthDate": "1990-05-20", "phone": "01012345678", "notes": "갱신된 기타사항" }
```
**Response 200**: 수정된 `emr_patients` 행 (POST 응답과 동일 형태)

**에러**: `404 PATIENT_NOT_FOUND` (GET과 동일 — 다른 클리닉 소유 포함)

이미 회원가입(claim)된 환자의 프로필도 이 엔드포인트로는 수정 가능하다 — claim 여부 체크는 시술기록/이용권 변경에만 걸려있다(아래 2절).

---

## 2. 시술기록 / 이용권

**핵심 설계**: 시술과 이용권은 1:1로 묶여 있다. "이용권 추가"라는 별도 행위가 없다 — 시술기록을 등록하는 순간 라디오로 ① 이미 갖고 있는 이용권에서 1회 차감하거나 ② 그 자리에서 새 이용권을 만들며 1회차를 바로 소비하는 것, 둘 중 하나를 고른다. 시술기록을 지우면 그 이용권도 같이 정리된다 — "이용권 삭제" API도 없다.

**회원가입(claim) 여부와 무관하게 항상 기록 가능**: 환자가 아직 회원가입 전이면 스테이징 테이블(`emr_care_records`/`emr_memberships`)에, 이미 회원가입했으면 실제 앱 테이블(`care_records`/`memberships`)에 곧바로 기록된다 — 재방문 고객의 시술도 계속 남길 수 있다. 응답의 `source`(`"emr"`|`"app"`) 필드로 어느 쪽에 기록됐는지 알 수 있다.

### POST /patients/{patientId}/care-records
`brand`는 로그인한 클리닉 계정에서 자동으로 채워진다(요청에 없음).

**DB** — 순서대로 실행됨
1. `emr_patients` **SELECT** `*` (`id`+`brand` 확인). `claimed_user_id`가 있는지로 이후 단계가 `emr_care_records`/`emr_memberships`(스테이징) 쪽으로 갈지 `care_records`/`memberships`(실제 앱) 쪽으로 갈지 정해진다 — 더 이상 여기서 막지 않는다
2. `reference_guides` **SELECT** (`care_type` 존재 확인, 없으면 `400`으로 중단)
3. **여기서 갈림 — `membershipId`를 보냈으면:**
   (1번에서 정해진) 이용권 테이블 **SELECT** `*` (`id`로 조회, 소유자 일치·`used_count < total_count` 확인) → **UPDATE** `used_count`+1, `last_used_at`=`careDate`
   **`totalSessions`를 보냈으면:**
   이용권 테이블 **INSERT** — 소유자(미가입이면 `patient_id`, 가입 완료면 `user_id`), `product_name`=`careName`, `total_count`=`totalSessions`, `used_count`=1, `last_used_at`=`careDate`, `available_care_names`=[`careName`]
4. 시술기록 테이블(`emr_care_records` 또는 `care_records`) **INSERT** — 소유자, `care_name`, `care_type`, `care_date`, `part_of_body`, `brand`(토큰에서), `practitioner`, `basic_aftercare_guide`, `doctor_comment`, `session_number`(=차감/생성 후 `used_count`), `total_sessions`(=`total_count`), `membership_id`(=3번에서 처리한 이용권 id). 가입 완료 환자면 추가로 `source_system`="aac_emr", `synced_at`=현재 시각도 같이 기록

**Request**
```json
{
  "careName": "울쎄라 300샷",
  "careType": "peeling",
  "careDate": "2026-08-15",
  "partOfBody": ["이마", "미간"],
  "practitioner": "김OO 원장",
  "basicAftercareGuide": ["당일 세안은 미온수로"],
  "doctorComment": "특이사항 없음",
  "totalSessions": 3
}
```
| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `careName` | string | required | 관리명 |
| `careType` | string | required | `GET /care-types` 목록에 있는 값만 허용 |
| `careDate` | string | required | `YYYY-MM-DD` |
| `partOfBody` | string[] | optional (기본 `[]`) | 관리 부위, `GET /body-parts` 목록 중 중복 선택 가능. 목록 밖 값은 `400 VALIDATION_ERROR` |
| `practitioner` | string | optional | 시술한 의사 이름 |
| `basicAftercareGuide` | string[] | optional (기본 `[]`) | |
| `doctorComment` | string | optional | |
| `membershipId` | string(uuid) | **택1** | 기존 이용권에서 1회 차감 |
| `totalSessions` | number | **택1** | 직접 입력 — 이 총 횟수로 새 이용권 생성, 1회차 즉시 소비 |

`membershipId`와 `totalSessions`는 **정확히 하나만** 보내야 한다(둘 다 보내거나 둘 다 생략하면 `400 VALIDATION_ERROR`).

**Response 201**
```json
{
  "careRecord": {
    "id": "uuid",
    "patient_id": "uuid",
    "care_name": "울쎄라 300샷",
    "care_type": "peeling",
    "care_date": "2026-08-15",
    "part_of_body": ["이마", "미간"],
    "brand": "AMRED CLINIC",
    "practitioner": "김OO 원장",
    "basic_aftercare_guide": ["당일 세안은 미온수로"],
    "doctor_comment": "특이사항 없음",
    "session_number": 1,
    "total_sessions": 3,
    "membership_id": "uuid",
    "created_at": "2026-08-15T09:10:00Z"
  },
  "membership": {
    "id": "uuid",
    "patient_id": "uuid",
    "product_name": "울쎄라 300샷",
    "total_count": 3,
    "used_count": 1,
    "remaining_count": 2,
    "expires_at": null,
    "last_used_at": "2026-08-15",
    "available_care_names": ["울쎄라 300샷"],
    "created_at": "2026-08-15T09:10:00Z"
  },
  "source": "emr"
}
```
`careRecord`/`membership` 필드는 각각 위 `GET /patients/{patientId}` 응답의 `careRecords[]`/`memberships[]` 항목과 필드 구성이 완전히 동일하다(위 표 참고 — 회원가입 완료 환자면 `patient_id` 대신 `user_id`, `source: "app"`). `session_number`/`total_sessions`는 이 시술이 이용권 처리 후의 스냅샷값(차감된 `used_count`/`total_count`)이다. 최상위 `source`(`"emr"`|`"app"`)는 이번 호출이 어느 테이블에 기록됐는지 알려주는 필드.

**에러**
| status/code | 상황 |
|---|---|
| `404 PATIENT_NOT_FOUND` | 존재하지 않거나 다른 클리닉 소유 |
| `400 INVALID_CARE_TYPE` | `careType`이 `GET /care-types` 목록에 없음 |
| `404 MEMBERSHIP_NOT_FOUND` | `membershipId`가 존재하지 않거나 다른 환자(또는 다른 앱 유저) 소유 |
| `409 MEMBERSHIP_EXHAUSTED` | 선택한 이용권의 잔여 횟수가 0 (`used_count >= total_count`) |

### DELETE /care-records/{careRecordId}
시술기록을 지우면 그 이용권도 함께 정리된다:
- 이 기록이 그 이용권을 참조하는 **유일한** 시술기록이었으면(직접입력으로 막 만든 경우) → **이용권을 통째로 삭제**
- 다른 시술기록도 같은 이용권을 쓰고 있으면(기존 이용권에서 차감한 경우) → **`used_count`만 1 되돌림**(0 미만으로는 안 내려감)

`careRecordId`가 스테이징(`emr_care_records`) 소속인지 실제 앱(`care_records`) 소속인지는 id만 보고 알 수 없다(회원가입 여부에 따라 갈리므로) — 그래서 `emr_care_records` 쪽을 먼저 찾아보고 없으면 `care_records` 쪽을 찾는다.

**DB** — 순서대로 실행됨
1. `emr_care_records`에서 `id`로 조회 — `id`, `membership_id`, `brand`(격리 확인, 직접 컬럼 비교). 있고 `brand`가 일치하면 아래 2~4단계를 `emr_care_records`/`emr_memberships`에 대해 수행하고 종료
2. 1번에서 못 찾았으면 `care_records`에서 같은 방식으로 `id` 조회(`brand` 컬럼 직접 비교) — 있으면 아래 2~4단계를 `care_records`/`memberships`에 대해 수행
3. (찾은 테이블에서) 시술기록 **DELETE** (`id`)
4. `membership_id`가 없었으면 종료. 있었으면 같은 테이블에서 **SELECT COUNT** (`membership_id`로 남은 시술기록 수 확인) → 0건이면 이용권 테이블 **DELETE**(`id`), 1건 이상이면 이용권 테이블 **SELECT** `used_count` → **UPDATE** `used_count`(1 감소, 최소 0)
5. 두 테이블 어디서도 못 찾았으면(또는 `brand` 불일치) `404 CARE_RECORD_NOT_FOUND`

**Response 204**: 본문 없음

**에러**
| status/code | 상황 |
|---|---|
| `404 CARE_RECORD_NOT_FOUND` | 존재하지 않거나, 그 시술기록의 환자가 다른 클리닉 소유 |

---

## 3. 통계

### GET /visit-stats
전날/금일(KST 기준) 로그인한 클리닉에 방문(시술기록이 있는)한, 그리고 익일 예약된 **실제 사람 수**(중복 제거 — 시술 건수가 아님). `(v0.2)` 이전엔 "오늘/어제/이틀 전"이었으나, 관리자 웹 대시보드 개편(어드민 프로토타입 `WHS_After_Mate_Admin_revised.html` 반영)으로 "전날/금일 방문 + 익일 예약"으로 바뀌었다.

**DB**
- `emr_care_records` **SELECT** (`brand`=로그인 클리닉, `care_date`가 전날/금일/익일 중 하나) + `emr_patients` 조인 — `patient_id`, `care_date`, `patient.claimed_user_id`
- `care_records` **SELECT** (`brand`=로그인 클리닉, 같은 날짜 조건) — `user_id`, `care_date`
- 날짜별로 두 결과를 하나의 "신원 집합"으로 합친다: `emr_care_records` 쪽은 이미 회원가입한 환자면 `claimed_user_id`로, 아직이면 `patient_id`로 식별값을 만들고, `care_records` 쪽은 `user_id`를 그대로 쓴다. 같은 날 "가입 전 방문 기록(emr)"과 "가입 후 방문 기록(app)"이 같은 사람 걸로 둘 다 있어도(당일 가입 케이스) `claimed_user_id`로 환산되어 하나로 합쳐지므로 중복 집계되지 않는다.
- **"익일 예약"은 별도 예약 테이블이 아니라 같은 시술기록 테이블을 그대로 재사용한다** — `POST .../care-records`의 `careDate`가 애초에 미래 날짜를 막지 않으므로, 관리 등록 화면에서 "관리 날짜"를 내일 이후로 선택해 저장하면 그 자체로 예약이 된다. 취소 기능은 아직 미구현(추후 앱 연동과 함께 별도 작업 예정).

**Response 200**
```json
{
  "yesterday": { "date": "2026-08-15", "count": 5 },
  "today": { "date": "2026-08-16", "count": 3 },
  "tomorrow": { "date": "2026-08-17", "count": 2 }
}
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `yesterday` / `today` / `tomorrow` | object | 각각 `{ date, count }`. `tomorrow`는 아직 시행 전이라 "방문"이 아니라 "예약" 의미 |
| `.date` | string | `YYYY-MM-DD` (KST 기준) |
| `.count` | number | 그 날짜에 방문(또는 예약)한 고객 수(중복 제거) |

**에러**: 없음(빈 결과여도 `count: 0`으로 정상 응답, 인증 실패 시의 공통 401만 해당)

---

## 클리닉 데이터 격리 정책

로그인한 관리자 계정의 `brand`가 모든 조회·수정의 기준이다:

- 환자 등록 시 `brand`가 자동으로 기록됨(수동 선택 불가)
- 환자 목록/상세/수정, 시술기록 추가/삭제 전부 `brand`가 일치하는 데이터만 대상
- 다른 클리닉 소유 데이터는 ID를 직접 넣어 요청해도 **`403`이 아니라 `404`** — 존재 자체를 숨겨서 다른 클리닉 데이터의 존재를 추측할 수 없게 함
- `emr_memberships`/`memberships`(이용권) 자체에는 `brand` 컬럼이 없다 — 시술기록의 `patient_id`/`user_id`를 거쳐 간접 격리된다(환자/유저가 이미 브랜드로 검증됐으므로 안전)
- 회원가입 완료 환자의 이용권(`memberships`)은 애초에 특정 클리닉 소유가 아니다(고객이 여러 클리닉을 다닐 수 있음) — `GET /patients/{patientId}`는 이 고객의 이용권 **전체**를 보여준다(다른 클리닉에서 만든 것 포함), 시술기록만 `brand`로 걸러서 이 클리닉 방문분만 보여준다
- `GET /care-types`/`GET /body-parts`는 예외 — 클리닉 공통 자료·고정 상수라 격리 대상이 아님

---

## 데이터 모델 요약

| 모델 | 테이블 | 핵심 필드 |
|---|---|---|
| Patient | `emr_patients` | id, patient_no, name, birth_date, phone, notes, brand, claimed_user_id, claimed_at |
| CareRecord | `emr_care_records`(미가입) 또는 `care_records`(가입 완료) | id, patient_id 또는 user_id, care_name, care_type, care_date, part_of_body, brand, practitioner, basic_aftercare_guide, doctor_comment, session_number, total_sessions, membership_id, **source**(API 응답에서만 붙는 파생 필드) |
| Membership | `emr_memberships`(미가입) 또는 `memberships`(가입 완료) | id, patient_id 또는 user_id, product_name, total_count, used_count, remaining_count(생성 컬럼), expires_at, last_used_at, available_care_names, **source** |
| AdminAccount | `admin_accounts` | id, username, password_hash, brand *(API로 노출되는 건 JWT payload의 adminId/username/brand뿐, 계정 목록 조회 API는 없음)* |

CareRecord/Membership이 어느 테이블에서 왔는지는 환자의 회원가입(claim) 여부에 따라 결정된다 — `POST .../care-records` 참고.

## 공통 에러 코드

| code | status | 상황 |
|---|---|---|
| `UNAUTHORIZED` | 401 | 토큰 없음/무효/만료 |
| `INVALID_CREDENTIALS` | 401 | 로그인 아이디/비밀번호 불일치 |
| `PATIENT_NOT_FOUND` | 404 | 환자 없음 또는 다른 클리닉 소유 |
| `INVALID_CARE_TYPE` | 400 | 검수되지 않은 careType |
| `MEMBERSHIP_NOT_FOUND` | 404 | 이용권 없음 또는 다른 환자 소유 |
| `MEMBERSHIP_EXHAUSTED` | 409 | 이용권 잔여 횟수 0 |
| `CARE_RECORD_NOT_FOUND` | 404 | 시술기록 없음 또는 다른 클리닉 소유 |
| `VALIDATION_ERROR` | 400 | 요청 형식 위반(zod) |
| `NOT_FOUND` | 404 | 존재하지 않는 라우트 |
| `INTERNAL_ERROR` | 500 | 서버 내부 오류 |

## 알려진 제한사항

- **관리자 계정 관리 API 없음** — 계정 생성/수정/삭제 전부 `npm run seed:admins` 스크립트로만 가능. 3개 클리닉 고정 전제라 API로 열어둘 필요가 아직 없음
- **JWT 만료 코드 미분리** — 토큰 만료도 다른 무효 토큰과 동일하게 `401 UNAUTHORIZED`로만 응답(별도 "재로그인 필요" 코드 없음)
- **`emr_patients.brand`가 DB상 nullable** — API로 등록하는 이상 항상 채워지지만, 스키마 제약(`NOT NULL`)까지는 아직 걸지 않음(마이그레이션 009 코멘트에 후속 예정으로 남겨뒀으나 미착수)
- **`patientId`/`careRecordId` 경로 파라미터가 UUID 형식으로 사전 검증되지 않음** — 잘못된 형식을 보내면 Supabase 레벨 오류가 `500 INTERNAL_ERROR`로 나올 수 있음
- **회원가입 이관 시점의 시술기록 중복 표시** — `GET /patients/{patientId}`에서 회원가입 이전 시술기록이 `source: "emr"`(원본)과 `source: "app"`(이관 복사본) 양쪽에 나타난다(위 해당 절 참고). 프론트에서 "같은 시술이 두 번 온다"고 오인하지 않도록 주의 필요
- **이용권(memberships)은 클리닉별로 격리되지 않음** — 회원가입한 고객의 이용권은 어느 클리닉에서 만들었든 전부 조회·차감 대상에 뜬다(실제 `memberships` 테이블에 `brand` 컬럼 자체가 없음). 다른 클리닉이 판 이용권을 실수로 차감하는 걸 막는 장치는 현재 없음
