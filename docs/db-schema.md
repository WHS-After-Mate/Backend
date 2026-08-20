# WHS After Mate — DB 스키마 (v0.12)

기준: `api-spec.md` v0.16, `admin-api-spec.md` v0.11. **PostgreSQL (Supabase)** 사용 — 계정·비밀번호·토큰은 Supabase Auth(`auth.users`)에 위임하고, 앱 데이터는 `public` 스키마에 직접 구성한다. 전화번호 SMS 인증은 국내 SMS 업체 연동 비용 때문에 MVP 범위 밖으로 확정되어 제거됐다(`server/db/migrations/004_remove_phone_verification.sql`) — `phone`은 이제 조회·표시용 연락처 값일 뿐이다.

v0.11 변경 (2026-08-20): `care_records`/`emr_care_records`에 `session_consumed boolean` 컬럼 추가(`026`) — 시술기록 등록 시 `careDate`가 오늘(KST)일 때만 이용권을 차감하도록 바뀌면서(미래 예약/과거 소급 등록은 연결만 하고 미차감), 개별 기록이 실제로 차감했는지 구분해야 `DELETE /care-records/{id}`가 `used_count`를 잘못 되돌리지 않을 수 있다. 자세한 내용은 하단 "예약 등록 시 이용권 미차감 지원 (026)" 절과 `admin-api-spec.md` v0.11 참고.

v0.10 변경: **`care_type` 개념을 완전히 제거**했다(`019`~`025`). `daily-guide`/`questions` 둘 다 `care_type` 그룹 단위 검수 가이드(`reference_guides`)로 근거를 삼던 것에서, **시술명(`care_name`)+경과일 직접 매칭 콘텐츠 테이블 `public.treatment_guides`**(`023`, 팀이 직접 작성, day는 1/3/5/7/14 고정)로 완전히 교체됐다 — `care_records`/`treatment_catalog`/`emr_care_records`의 `care_type` 컬럼과 `reference_guides`/`aftercare_guides` 테이블이 전부 삭제됐다(`024`, `025`). **`GET /aftercare/daily-guide`는 이제 LLM을 아예 호출하지 않는다** — `treatment_guides`를 직접 조회해 즉시 반환하고, 매칭이 없으면 LLM 폴백 없이 바로 404. LLM 호출 지점은 이제 `questions`(챗봇, 근거를 `treatment_guides`로 교체)와 `recommendations`(다음 관리 추천) 두 곳뿐이다. 그 밖에 `treatment_catalog`에 `brand` 컬럼 추가(`021`, 클리닉별 시술 카탈로그 격리)와 FCM 푸시 알림 인프라(`019` 알림 설정 컬럼, `020` 발송 로그 테이블)도 이번 배치에 함께 들어갔다. 자세한 내용은 하단 "care_type 제거 + treatment_guides 도입 (019~025)" 절 참고.

v0.9 변경: 앱 연동 중 "이용권이 어느 클리닉 것인지 구분해야 한다"는 요청으로 `memberships`/`emr_memberships`에 `brand` 컬럼 추가(`016_add_membership_brand.sql`) — `care_records`/`emr_care_records`는 처음부터 갖고 있던 필드다. 순수 표시용 메타데이터로, 이용권 차감/자동 이어쓰기 매칭 로직은 여전히 브랜드와 무관하게 동작한다(정책 변경 아님). 기존 행은 `membership_id`로 연결된 시술기록의 `brand`로 백필됨. 자세한 내용은 하단 "public.memberships"/"public.emr_memberships" 절 참고.

v0.8 변경: 관리 추천용 실데이터 카탈로그 신규 테이블 `public.businesses`/`public.procedures` 추가(`015_add_care_catalog.sql`) — 사업장 3곳 + 실제 시술 46종. 다음 관리 추천이 고객 보유 이용권 기반에서 이 카탈로그 전체 기반으로 교체됐다. 자세한 내용은 하단 "실제 사업장/시술 카탈로그 추가 (015)" 절 참고.

v0.7 변경: 관리자 웹 프로토타입의 치료-부위 카탈로그 방식을 도입 — 신규 테이블 `public.treatment_catalog`(치료명→기본 careType/관리 부위 매핑, 클리닉 공통, `013_add_treatment_catalog.sql`) 추가. 스키마 변경은 아니지만 `emr_memberships`/`memberships`의 기존 `expires_at`(date, nullable) 컬럼을 `server_admin`이 이제 실제로 채워 쓰기 시작함(이용권 생성일=첫 시술일 기준 +1년, 만료 시 차감 차단) — 자세한 내용은 하단 "치료-부위 카탈로그 추가 (013)" 절 참고.

v0.6 변경: 관리자용 가상 EMR 스택이 클리닉별 로그인 기반으로 확장됐다 — 회원가입 인증코드 발급 절차를 없애고 **환자번호+이름+생년월일 일치**로 신원을 확인하는 방식으로 단순화(`signup_verification_codes` 테이블 삭제, 010), 클리닉 관리자 로그인(`admin_accounts`, 008)과 클리닉별 데이터 격리(`store` 컬럼 제거+`emr_patients.brand` 추가, 009), 시술기록↔이용권 연결(`emr_care_records.membership_id`, 011), 관리 부위 배열화(`part_of_body text[]`, 012), 이용권 잔여횟수 생성 컬럼(`emr_memberships.remaining_count`, 007)이 전부 이 범위에서 추가됐다. 비밀번호 재설정도 이메일 링크에서 숫자 인증코드(Supabase `verifyOtp`) 방식으로 바뀌었다(DB 마이그레이션 없음). 자세한 내용은 하단 007~012 절 참고.

v0.4 변경: 회원가입을 이메일/비밀번호 자유 가입에서 환자번호+인증코드 기반 가입으로 교체하며, 관리자용 가상 EMR 스테이징 테이블 4종(`emr_patients`/`emr_care_records`/`emr_memberships`/`signup_verification_codes`)을 신규 추가했다(`server/db/migrations/006_add_admin_emr_staging_tables.sql`). **이후 v0.6(010)에서 인증코드 절차 자체가 이름+생년월일 대조로 대체되며 `signup_verification_codes`는 삭제됐다** — 아래 테이블 정의는 현재(v0.6) 기준으로 갱신했다.

v0.3 변경: `api-spec.md` v0.5(와이어프레임 검토 반영)에 대응하는 스키마 변경. `profiles`에 컬럼 2개 추가, `care_records`에 컬럼 4개 추가, `membership_usages` 신규 테이블 1개. **마이그레이션(`server/db/migrations/003_v05_wireframe_features.sql`)이 Supabase 프로젝트에 실제 적용됐고, 데모 데이터도 `npm run seed`로 재시드해 새 필드가 채워진 상태를 확인했다.** 자세한 내용은 하단 "v0.3에서 추가된 항목" 절 참고.

시각 자료(ERD, 확대/드래그 가능한 다이어그램)는 `db-schema.html` 참고.

---

## 인증 (Supabase 관리, 직접 구현 안 함)

이메일/비밀번호 계정 생성, 비밀번호 해싱, access/refresh 토큰 발급·재발급·폐기는 Supabase Auth가 처리한다. 우리 테이블은 `auth.users.id`를 FK로 참조만 한다.

**가입 흐름** *(v0.6 — 환자번호+이름+생년월일 대조 기반, `010_signup_identity_check_and_patient_notes.sql`)*: `POST /auth/signup({patientNo, name, birthDate, email, password, interestGoals})` 호출 → `emr_patients`에서 `patient_no`로 환자 조회(없으면 `PATIENT_NOT_FOUND`, 이미 `claimed_user_id`가 있으면 `PATIENT_ALREADY_CLAIMED`) → 조회된 레코드의 `name`/`birth_date`가 요청값과 정확히 일치하는지 대조(`PATIENT_IDENTITY_MISMATCH`, 별도 인증코드 발급 절차 없음) → `supabase.auth.admin.createUser()` → 생성된 `user.id`로 `profiles` 행 insert(이름/전화/생년월일은 클라이언트 입력이 아니라 `emr_patients` 원본 값) + `medical_profiles` insert(`emr_patients.notes`를 `doctor_general_comment`로 이관) + `emr_care_records`/`emr_memberships`를 `care_records`/`memberships`로 **1회성 이관(claim)** + `emr_patients.claimed_user_id`/`claimed_at` 기록. 이관 단계 중 하나라도 실패하면 방금 만든 Auth 유저를 롤백(`deleteUser`) — `profiles`/`medical_profiles`/`care_records`/`memberships`는 `auth.users`에 CASCADE로 걸려있어 유저 삭제 시 함께 정리되고, `emr_patients`는 claim 처리 전이므로 그대로 남아 재시도 가능하다(`auth.service.ts`의 `signup()` 참고). *(v0.4 시점엔 `signup_verification_codes` 테이블로 발급하는 별도 인증코드 대조 방식이었으나 010에서 이 방식으로 대체되며 테이블 자체가 삭제됐다 — 아래 "제거됨" 절 참고.)*

**비밀번호 재설정/변경** *(구현 완료, DB 마이그레이션 불필요)*: 별도 테이블이 필요 없다. `POST /auth/password/reset-request`는 `supabaseAnon.auth.resetPasswordForEmail()`에 위임. `POST /auth/password/reset-confirm`은 `{email, code, newPassword}`를 받아 `code`를 `supabaseAnon.auth.verifyOtp({ email, token: code, type: "recovery" })`로 검증한 뒤 `supabaseAdmin.auth.admin.updateUserById(userId, { password })`로 갱신한다(`auth.service.ts`) — Supabase 이메일 템플릿의 `{{ .Token }}` 숫자 코드를 그대로 쓰는 방식으로, 링크(`access_token`) 기반이었던 이전 설계에서 전환됐다. `POST /profile/password`(로그인 상태에서 변경)는 `currentPassword`로 `signInWithPassword` 재검증 후 동일하게 `updateUserById`로 처리(`profile.service.ts`) — 셋 다 Supabase Auth가 비밀번호 해싱/토큰을 전담하므로 우리 쪽 테이블 추가 없음.

---

## 클리닉 의료 데이터 연동 — 구조적 전제

이 서비스는 **클리닉(AAC)의 의료 데이터베이스(EMR)에 이미 존재하는 환자 기록**을 바탕으로 환자 본인에게 사후관리를 제공한다 (환자가 자기 진료기록을 열람하는 patient-portal과 같은 구조). 즉 `care_records`의 시술 이력, 알러지 정보, 의사 코멘트는 **우리 앱이 원본 데이터를 만드는 게 아니라 클리닉 EMR에서 동기화(sync)해온 사본**이다.

- **원본(source of truth)**: 클리닉 EMR (별도 시스템, 이 저장소 범위 밖)
- **우리 DB의 역할**: EMR에서 필요한 필드만 읽기 전용으로 동기화해 patient-facing 앱과 LLM 컨텍스트에 사용
- **MVP 범위**: 실제 클리닉 EMR 시스템 연동 대신, 관리자용 가상 EMR 스테이징 테이블(`emr_patients` 등, 아래 "가상 EMR 스테이징 테이블 추가 (006)" 절)에 의료진이 직접 입력한 데이터를 회원가입 시 1회성으로 이관(claim)한다. 스키마는 나중에 실제 배치 동기화(ETL)로 교체 가능하도록 `external_*_id` / `synced_at` / `source_system` 필드를 처음부터 넣어둔다. *(데모용 시드 스크립트 `server/db/seed/seed.ts`는 이 claim 흐름과 무관하게 별도로 계정을 직접 생성한다 — 아래 "가상 EMR..." 절 참고)*
- **왜 알러지·의사코멘트가 중요한가**: `POST /aftercare/questions`(LLM 답변)와 `GET /aftercare/daily-guide`(일차별 가이드) 생성 시, 알러지·의사 코멘트를 컨텍스트에 포함시켜야 "환자가 알러지 있는 성분을 권하는" 것 같은 실수를 막을 수 있다.
- **민감정보 취급**: 알러지·의사 코멘트는 개인정보보호법상 건강에 관한 민감정보에 해당한다. 접근 로그(`medical_data_access_log`)를 별도로 남긴다.

---

## 테이블 정의

### public.profiles — 1:1 auth.users

```sql
create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  birth_date date,
  phone text unique,
  interest_goals text[] not null default '{}',
  care_notification boolean not null default true,
  marketing_notification boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

| 컬럼 | 설명 |
|---|---|
| `user_id` | PK, `auth.users(id)` 참조, 계정 삭제 시 CASCADE |
| `birth_date` | *(v0.3 신규)* 내 정보 화면의 생년월일. `GET /profile` 응답 `birthDate` |
| `interest_goals` | 관심 목표 — 추천 API(`basis: goal`)의 입력값 |
| `care_notification` / `marketing_notification` | *(v0.10 신규, 마이그레이션 019)* 사후관리 알림(시술 등록/예약, 일차별 마일스톤, 이용권 만료 리마인더) vs 마케팅 알림 on/off. `GET/PATCH /profile/notifications`로 조회/변경 |

→ `GET/PATCH /profile`, `PUT /profile/interests` 모두 이 한 테이블로 처리.
→ `phone`은 기존부터 있던 컬럼(가입 시 입력한 연락처)이며, `GET /profile` 응답에 `phone` 필드로 노출하는 것 자체는 v0.5에서 새로 추가된 것이지 컬럼 자체는 신규가 아니다. `phone_verified_at` 컬럼은 전화인증 기능 제거와 함께 삭제됐다(`004_remove_phone_verification.sql`).
→ *(v0.5~v0.9 구간)* `push_enabled`/`aftercare_reminder`/`membership_expiry_alert`/`marketing_alert` 컬럼은 실제로 읽어 분기하는 발송 로직이 없는 placeholder였던 `GET/PATCH /notifications/settings` 엔드포인트와 함께 삭제됐었다(`005_remove_notification_settings.sql`). **v0.10(019)에서 알림 설정이 재도입됐다** — 이번엔 `push.service.ts`의 `sendPushToUser`가 종류별로 이 값을 실제로 읽어 분기하므로(꺼져 있으면 발송 스킵) placeholder가 아니다. 예전 4컬럼 대신 사후관리(`care`)/마케팅(`marketing`) 2가지로 단순화됐다.

### ~~public.phone_verifications~~ — 제거됨

전화번호 SMS 인증 기능 자체를 MVP 범위 밖으로 확정하며 `004_remove_phone_verification.sql`로 테이블을 삭제했다. 원래는 가입 전 단계(계정과 미연결)의 OTP 코드 해시·오입력 횟수·재요청 주기 제한을 저장하던 독립 테이블이었다.

### public.care_records — 클리닉 EMR에서 동기화된 시술 이력

```sql
create table public.care_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  care_name text not null,
  care_date date not null,
  part_of_body text[] not null default '{}',
  brand text,
  practitioner text,
  status text not null default 'completed',
  session_number int,
  total_sessions int,
  membership_id uuid references public.memberships(id) on delete set null,
  basic_aftercare_guide text[] not null default '{}',
  doctor_comment text,
  external_record_id text,
  source_system text not null default 'aac_emr',
  synced_at timestamptz,
  created_at timestamptz not null default now(),
  session_consumed boolean not null default true
);

create index idx_care_records_user_date
  on public.care_records (user_id, care_date desc);

create unique index idx_care_records_external_id
  on public.care_records (external_record_id)
  where external_record_id is not null;
```

- `care_type` 컬럼은 v0.10(`024`)에서 삭제됐다. `daily-guide`/`questions`의 근거는 이제 `care_type` 그룹 단위가 아니라 `treatment_guides`에서 `care_name`(이 표에 남아있는 시술명 그대로)+경과일로 직접 매칭한다(아래 "public.treatment_guides" 절 참고)
- `part_of_body` *(v0.6, 마이그레이션 012)*: 텍스트 단일값에서 배열로 변경 — 한 시술이 여러 부위에 동시에 이뤄질 수 있어(예: "이마+미간") 중복 선택 가능하게 함. `emr_care_records`도 동일하게 배열
- `store` 컬럼은 v0.6(009)에서 제거됐다 — 클리닉당 지점이 하나뿐이라 `brand`와 항상 1:1이었던 순수 중복 컬럼
- `status` *(v0.3, 마이그레이션 003)*: `GET /care-records`/`{id}` 응답의 `status`. 기본값 `completed`(EMR 동기화 데이터는 이미 끝난 시술 위주)
- `session_number` / `total_sessions` *(v0.3, 마이그레이션 003)*: 관리 상세의 "관리 회차: 2/3회차". nullable — 회차 개념이 없는 단건 시술은 비워둠. `(v0.11)` `session_number`는 저장 시점에 고정되지 않고 `server_admin`이 이용권 상태가 바뀔 때마다(차감/차감취소/새 예약추가) 다시 계산해 덮어쓴다 — "몇 회차"인지는 항상 최신 상태를 반영한다(아래 `session_consumed` 참고)
- `membership_id` *(v0.3, 마이그레이션 003)*: 이 시술이 연결된 이용권 FK. `on delete set null`로 이용권이 삭제돼도 시술 기록 자체는 보존. **마이그레이션 순서 주의**: `public.memberships`가 먼저 생성되어 있어야 하므로, 실제 적용 시 이 테이블 정의를 `memberships` 다음으로 옮기거나 `ALTER TABLE ... ADD COLUMN membership_id ...`를 memberships 생성 후 별도 스텝으로 분리해야 한다(문서 내 테이블 순서는 설명 편의상 EMR 연동 그룹을 앞에 둔 것)
- `session_consumed` *(v0.11, 마이그레이션 026)*: 이 시술기록이 등록 당시 실제로 이용권 1회를 차감했는지. `server_admin`의 `POST .../care-records`는 `careDate`가 등록 시점 기준 오늘(KST)일 때만 차감하고(`true`), 미래 예약이나 과거 소급 등록은 이용권을 연결만 하고 차감하지 않는다(`false`) — 아래 "예약 등록 시 이용권 미차감 지원 (026)" 절 참고. 기본값 `true`는 이 기능 도입 이전 기존 행(전부 등록 즉시 차감이었음)을 위한 백필값
- `doctor_comment`: 해당 시술 건에 대한 의사의 코멘트 (EMR 원본). 환자에게 노출할지는 프론트 정책에 따라 다르지만, LLM 컨텍스트에는 항상 포함
- `external_record_id` / `source_system` / `synced_at`: EMR 원본 레코드 추적용. MVP에선 시드 데이터라 비워두거나 더미값 사용, 실연동 시 이 필드로 중복 동기화 방지

→ `GET /care-records`(필터: `dateFrom`/`dateTo`/`partOfBody`/`brand`), `GET /care-records/{id}`.
**캘린더**(`GET /care-records/calendar`)는 별도 테이블 없이 집계 쿼리로 처리:
```sql
select care_date, count(*) as count
from public.care_records
where user_id = $1 and care_date between $2 and $3
group by care_date;
```

### public.medical_profiles — 클리닉 EMR에서 동기화된 환자 의료 정보 (민감정보)

```sql
create table public.medical_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  external_patient_id text unique,
  allergies text[] not null default '{}',
  chronic_conditions text[] not null default '{}',
  doctor_general_comment text,
  source_system text not null default 'aac_emr',
  synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

- `allergies` / `chronic_conditions`: 알러지 성분, 기저 질환 — LLM이 사후관리 답변을 생성하기 전에 반드시 참조해야 하는 안전 컨텍스트
- `doctor_general_comment`: 시술 건별 코멘트(`care_records.doctor_comment`)와 별개로, 환자 전반에 대한 의사의 일반 코멘트
- `external_patient_id`: 클리닉 EMR의 환자 ID (연동 키). `care_records`가 시술 단위 동기화라면 이 테이블은 환자 단위 동기화
- `profiles`(앱 계정 프로필)와 분리한 이유: 이 테이블은 "우리 앱이 만드는 데이터"가 아니라 "EMR에서 읽어온 데이터"라 접근 권한·감사 로그를 다르게 관리하기 위함

### public.medical_data_access_log — 민감 의료정보 접근 감사 로그

```sql
create table public.medical_data_access_log (
  id uuid primary key default gen_random_uuid(),
  patient_user_id uuid not null references auth.users(id) on delete cascade,
  accessed_by text not null,
  accessed_fields text[] not null,
  request_context text,
  accessed_at timestamptz not null default now()
);

create index idx_medical_access_log_patient
  on public.medical_data_access_log (patient_user_id, accessed_at desc);
```

- `accessed_by`: 예 `patient_self`(본인 조회) / `llm_system`(가이드·답변 생성 시 컨텍스트로 사용) / `admin`
- `accessed_fields`: 예 `['allergies']`, `['doctor_comment']` — 어떤 민감 필드가 조회됐는지 기록
- `request_context`: 예 `GET /aftercare/daily-guide`, `POST /aftercare/questions` — 어느 API 호출에서 발생했는지
- 알러지·의사 코멘트는 개인정보보호법상 건강 정보(민감정보)라 접근 이력을 남겨두는 것이 안전. LLM이 답변 생성을 위해 참조할 때도 한 행씩 기록

### public.memberships

```sql
create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_name text not null,
  total_count int not null default 0,
  used_count int not null default 0,
  remaining_count int generated always as (total_count - used_count) stored,
  expires_at date,
  last_used_at date,
  available_care_names text[] not null default '{}',
  brand text,
  external_record_id uuid,
  created_at timestamptz not null default now()
);

create index idx_memberships_user_expiry
  on public.memberships (user_id, expires_at);

create unique index idx_memberships_external_id
  on public.memberships (external_record_id)
  where external_record_id is not null;
```

- `remaining_count`는 GENERATED 컬럼 — 직접 갱신 불필요, `used_count`만 늘리면 자동 계산됨
- `expires_at` *(컬럼 자체는 001부터 존재, v0.7부터 `server_admin`이 실제로 채움)*: `server_admin`이 이용권을 새로 만들 때 그 시술 날짜(`careDate`) 기준 +1년으로 계산해 넣는다(이어서 차감할 때는 재계산하지 않음). 만료 후 차감 시도는 `server_admin` 서비스 레이어에서 거부(`MEMBERSHIP_EXPIRED`) — DB 제약이 아니라 애플리케이션 레벨 검증
- `brand` *(v0.9, 마이그레이션 016)*: 이 이용권을 처음 만든 클리닉. `care_records.brand`와 마찬가지로 순수 표시용 메타데이터일 뿐, 이용권 차감/자동 이어쓰기 매칭(`findContinuableMembership`)에는 여전히 쓰이지 않는다 — 이용권은 클리닉 간 격리되지 않는다는 기존 정책 그대로 유지. 생성 시 `server_admin`의 `addCareRecord`가 로그인 클리닉의 `brand`를 그대로 채우고, 회원가입 이관(`migrateEmrDataToApp`) 시에는 `emr_memberships.brand`를 그대로 복사한다. 마이그레이션 016 적용 이전에 만들어진 기존 행은 `membership_id`로 연결된 `care_records`/`emr_care_records` 중 가장 먼저 생성된 기록의 `brand`로 백필됨(이 프로젝트는 "이용권 추가"라는 별도 행위가 없어 모든 이용권이 시술기록과 함께 생성되므로 백필 커버리지는 항상 100%)
- `external_record_id` *(v0.12, 마이그레이션 027)*: 회원가입(claim) 시 이관된 이용권이면 원본 `emr_memberships.id`를 그대로 담는다(`care_records.external_record_id`와 동일한 역할, `memberships`엔 이 컬럼이 없었던 것). 회원 탈퇴(`DELETE /profile`) 시 "이미 emr에 원본이 있는 이관분"과 "가입 후 새로 생긴 신규 이용권"을 구분하는 용도 — 이관분은 원본을 최신 상태로 갱신하고, 신규분만 새 `emr_memberships` 행으로 되돌린다(`profile.service.ts`의 `rehydrateEmrData`). 이 컬럼 도입 이전에 이관된 기존 행은 출처를 알 수 없어 `null`로 남고, 탈퇴 시 "가입 후 신규"로 간주돼 새 행으로 되돌아간다(데이터 유실보다는 안전한 방향)

### public.membership_usages — 이용권 회차별 사용 이력 *(v0.3, 마이그레이션 003)*

```sql
create table public.membership_usages (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid not null references public.memberships(id) on delete cascade,
  care_record_id uuid references public.care_records(id) on delete set null,
  session_number int not null,
  used_at date not null,
  created_at timestamptz not null default now(),
  unique (membership_id, session_number)
);

create index idx_membership_usages_membership
  on public.membership_usages (membership_id, session_number);
```

- 이용권 화면(`GET /memberships`/`{id}`)의 "1회차 2026.01.01(일)", "2회차 2026.03.01(일)" — `used_count`(집계값)만으로는 회차별 날짜를 복원할 수 없어 별도 테이블로 분리
- `care_record_id`: 어떤 시술 건이 이 회차를 소모했는지 역참조(선택). `care_records.membership_id`와 함께 있으면 양방향 조회 가능하지만, 회차 자체는 이 테이블이 유일한 사실 근거
- `unique (membership_id, session_number)`: 같은 이용권에서 회차 번호 중복 방지

### ~~public.aftercare_guides~~ — 제거됨 (v0.10, 마이그레이션 024)

LLM이 생성한 일차별 가이드를 하루 1회로 캐시하던 테이블. `GET /aftercare/daily-guide`가 더 이상 LLM을 호출하지 않고 `treatment_guides`를 직접 조회해 즉시 응답하므로(아래 절 참고) 캐시할 대상 자체가 없어져 테이블째 삭제했다.

### public.treatment_guides — 시술명+경과일 직접 매칭 사후관리 콘텐츠 *(v0.10 신설 023)*

```sql
create table public.treatment_guides (
  id uuid primary key default gen_random_uuid(),
  care_name text not null,
  day int not null check (day in (1, 3, 5, 7, 14)),
  key_care text not null,
  aftercare text[] not null,
  precautions text[] not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (care_name, day)
);
```

- `care_type` 그룹 단위(예: `botox`)로 검수 문구를 공유하던 `reference_guides`를 대체 — 같은 그룹으로 묶여도 시술마다(장비·성분이 달라) 실제 사후관리 내용이 다르다는 문제가 있어, 시술명(`care_name`) 단위로 팀이 직접 콘텐츠를 작성해 저장한다
- `day`는 1/3/5/7/14 다섯 값만 존재 — 앱의 daily-guide 화면이 이 다섯 일차 탭만 쓰기 때문(그 외 날짜는 화면 자체가 없음)
- `brand`로 나누지 않고 `care_name`만으로 키를 잡는다 — 같은 시술명(예: "슈링크 유니버스")이 여러 클리닉에 있어도 실제 시술 내용/사후관리는 동일하므로 콘텐츠를 중복 작성하지 않는다
- `GET /aftercare/daily-guide`(`aftercare.service.ts`의 `getOrGenerateDailyGuide`)가 `care_records.care_name`+요청된 경과일로 이 테이블을 직접 조회해 그대로 반환한다 — **LLM 호출이 전혀 없다.** 매칭되는 행이 없으면(그 시술/일차 콘텐츠가 아직 없음) LLM 폴백 없이 바로 `404 GUIDE_NOT_AVAILABLE`
- `POST /aftercare/questions`(챗봇 Q&A)도 이 테이블을 `reviewedGuide` 근거로 LLM 프롬프트에 주입한다 — 이쪽은 여전히 LLM을 호출하지만(자유 질문에 답해야 하므로), 근거 소스만 `reference_guides`에서 이 테이블로 바뀌었다
- 팀이 시술 46종 전체를 직접 작성해 커버하므로(`server/db/seed/seedTreatmentGuides.ts`), `reference_guides`에 있던 "미검수 스텁 문구가 검수된 문구와 구분 없이 노출된다"는 문제 자체가 구조적으로 사라졌다(검수 여부 컬럼이 없다 — 애초에 전부 팀 작성 콘텐츠라 검수 대상이 아님)

### public.questions

```sql
create table public.questions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  care_record_id uuid references public.care_records(id) on delete set null,
  category text not null,
  question text not null,
  status text not null check (status in ('answered', 'out_of_scope', 'expert_required')),
  answer text,
  answered_by text default 'llm',
  expert_contact_required boolean not null default false,
  consultation_level text not null default 'NONE'
    check (consultation_level in ('NONE', 'RECOMMENDED', 'URGENT')),
  created_at timestamptz not null default now()
);

create index idx_questions_user_created
  on public.questions (user_id, created_at desc);
```

- `care_record_id`는 nullable — 관리 이력이 삭제돼도 질문 이력 자체는 남긴다(`on delete set null`)
- `status` CHECK 제약으로 `POST /aftercare/questions`의 세 가지 상태값만 허용
- `consultation_level` *(마이그레이션 017)*: `status`와 별개 축 — "답변은 했지만 실제 상태 확인이 필요한 정도"를 LLM이 함께 판단(`NONE`/`RECOMMENDED`/`URGENT`). 위험 신호 키워드에 안 걸린 애매한 증상 질문(예: "며칠째 붓기가 안 빠지는데 괜찮은 걸까요?")을 무조건 답변 또는 무조건 범위 밖 처리하던 이분법을 보완한다. `status`가 `answered`일 때만 LLM이 실제로 채우고, `out_of_scope`/`expert_required`는 기본값 `NONE` 그대로 저장됨

### ~~public.reference_guides~~ — 제거됨 (v0.10, 마이그레이션 024)

`care_type` 그룹+경과구간 단위로 검수 문구를 저장하던 테이블. 위 "public.treatment_guides" 절에서 설명한 대로 시술명 직접 매칭 콘텐츠로 완전히 대체되며 테이블째 삭제했다 — "`reviewed_by`/`reviewed_at`가 코드에서 검사되지 않아 미검수 스텁이 검수 문구와 구분 없이 노출된다"는 이 테이블의 알려진 결함도 함께 해소됐다.

### public.businesses — 실제 사업장 정보 *(v0.8 신설 015)*

```sql
create table public.businesses (
  id text primary key,
  name text not null,
  brand text not null unique,
  talk_channel_label text,
  talk_channel_url text,
  phone text
);
```

- 실제 사업장 3곳(엠레드/더나/윔) 공개 정보 — `docs/care_procedure_template.xlsx`를 `server/db/seed/seedCareCatalog.ts`로 반영
- `brand`는 `admin_accounts.brand`/`care_records.brand`와 동일한 값(예: `"AMRED CLINIC"`) — FK 아님, 기존 브랜드 매칭 관례와 동일하게 문자열로만 대조
- 카카오톡 상담 링크/전화번호는 관리 추천 상세 화면(`clinicContacts`)에서 노출

### public.procedures — 실제 시술 카탈로그 (관리 추천용) *(v0.8 신설 015)*

```sql
create table public.procedures (
  id uuid primary key default gen_random_uuid(),
  business_id text not null references public.businesses(id),
  name text not null,
  category_tags text[] not null default '{}',
  description text,
  created_at timestamptz not null default now(),
  unique (business_id, name)
);
```

- 사업장별 실제 시술 46종(2026-08-17 xlsx 기준) — `category_tags`는 고정 concernTag 10종(`server/src/lib/concernTags.ts`) 중 이 시술이 다루는 고민 영역
- **`recommendations.service.ts`가 이 테이블 전체를 추천 후보 풀로 쓴다** — 고객이 이용권을 보유했는지와 무관하게, `interest_goals`/최근 시술의 `category_tags`가 겹치는 시술을 추천한다(v0.7까지는 고객이 보유한 이용권의 `availableCareNames` 안에서만 후보를 골랐음 — 아래 "실제 사업장/시술 카탈로그 추가 (015)" 절 참고)
- `treatment_catalog`(013, 관리자 웹의 시술기록 등록 자동완성용)와는 목적이 다른 별도 테이블이다 — 이쪽은 concernTag 기반 고객 추천용, `treatment_catalog`는 브랜드+관리 부위 기반 EMR 입력 보조용. 두 테이블이 실제로는 겹치는 시술을 담고 있을 수 있지만 아직 통합하지 않았다

### public.device_tokens — Android FCM 푸시 토큰 (서버 구현 시 신규)

```sql
create table public.device_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  fcm_token text not null unique,
  platform text not null default 'android',
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
```

- Android 클라이언트가 발급받은 FCM 토큰을 `POST /notifications/device-token`으로 등록. **v0.10(019/020)부터 실제 발송까지 구현됨** — `server/src/services/notificationScheduler.service.ts`가 매일 09:00 KST(일차별 마일스톤 1/3/5/7/14일, 이용권 만료 30일/7일 전)와 19:00 KST(당일 시술 등록 안내)에 크론으로 대상을 조회해 `push.service.ts`의 `sendPushToUser`로 발송한다(`server.ts`가 `FCM_ENABLED=true`일 때만 스케줄러를 기동). `server_admin`도 별도로 자체 FCM 설정(`server_admin/src/config/firebase.ts`)을 갖고 있어, 시술 예약 등록 즉시(`addCareRecord`) 알림을 보낸다 — 두 서비스가 프로세스가 분리돼 있어 FCM 설정도 각자 보관

### public.notification_log — 알림 발송 로그 *(v0.10 신설 020)*

```sql
create table public.notification_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  ref_id uuid not null,
  ref_key text not null,
  sent_at timestamptz not null default now(),
  unique (type, ref_id, ref_key)
);
```

- 3종 알림이 이 테이블을 공유한다: `care_registered`(`server_admin`의 `addCareRecord`가 시술 등록 즉시 발송, `ref_key: 'registered'`), `day_milestone`(`server`의 일일 09시 크론, `ref_key: '1'/'3'/'5'/'7'/'14'`), `membership_expiry`(`server`의 일일 09시 크론, `ref_key: '30'/'7'`)
- `unique (type, ref_id, ref_key)`로 같은 알림이 중복 발송되는 것을 DB 제약으로 막는다 — `notificationScheduler.service.ts`는 "보내고 나서 기록"이 아니라 이 테이블에 먼저 insert를 시도해 성공한 경우에만 실제로 보내는 순서(claim-then-send)라, 크론이 겹쳐 돌아도 중복 발송되지 않는다

### public.emr_patients — 가상 EMR 환자 프로필 (계정 미연결 상태로 시작) *(v0.4 신설 006, v0.6 컬럼 개편 009/010)*

```sql
create table public.emr_patients (
  id uuid primary key default gen_random_uuid(),
  patient_no text not null unique,
  name text not null,
  birth_date date not null,
  phone text not null,
  notes text,
  brand text,
  claimed_user_id uuid references auth.users(id) on delete set null,
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_emr_patients_phone on public.emr_patients (phone);
```

- `auth.users`와 무관하게 독립적으로 존재 — `server_admin`(관리자 웹 백엔드)이 환자 등록 시 채우는 원본 데이터
- `patient_no`: 병원에서 발급하는 환자번호. 앱 회원가입 시 이름+생년월일과 함께 대조해 신원 확인에 사용(v0.6, 010 — 별도 인증코드 발급 없음)
- `notes` *(v0.6, 마이그레이션 010)*: 기타사항 — 원래 `allergies`/`chronic_conditions`/`doctor_general_comment` 3개 컬럼으로 구조화 입력받던 것을 자유입력 텍스트 하나로 통합. claim 시 `medical_profiles.doctor_general_comment`로 그대로 이관(`allergies`/`chronic_conditions`는 빈 배열로 시작)
- `brand` *(v0.6, 마이그레이션 009)*: 환자를 등록한 클리닉(`admin_accounts.brand`와 매칭). 환자 등록(`POST /patients`) 시점에 로그인한 관리자의 brand를 그대로 기록 — 클리닉별 데이터 격리(다른 클리닉 환자는 조회 자체가 404)의 근거
- `claimed_user_id`: 회원가입으로 이 환자 기록을 실제 계정에 연결(claim)한 시점의 `auth.users.id`. `null`이면 아직 미가입 상태이며, 값이 있으면 중복 가입 방지 겸 이관 완료 표시로 쓰인다. claim 이후에도 `server_admin`에서 이 환자에게 새 시술기록을 추가할 수 있으며, 이때는 스테이징이 아니라 실제 `care_records`/`memberships`에 곧바로 기록된다

### public.emr_care_records — 계정 연결 전 시술 이력 *(v0.4 신설 006, v0.6 컬럼 개편 009/011/012, v0.10 컬럼 삭제 025, v0.11 컬럼 추가 026)*

```sql
create table public.emr_care_records (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.emr_patients(id) on delete cascade,
  care_name text not null,
  care_date date not null,
  part_of_body text[] not null default '{}',
  brand text,
  practitioner text,
  basic_aftercare_guide text[] not null default '{}',
  doctor_comment text,
  session_number int,
  total_sessions int,
  membership_id uuid references public.emr_memberships(id) on delete set null,
  created_at timestamptz not null default now(),
  session_consumed boolean not null default true
);

create index idx_emr_care_records_patient on public.emr_care_records (patient_id, care_date desc);
create index idx_emr_care_records_membership on public.emr_care_records (membership_id);
```

- 컬럼 구성은 `public.care_records`와 거의 동일 — claim 시 그대로 복사되기 때문(`auth.service.ts`의 `migrateEmrDataToApp`). `care_type` 컬럼은 v0.10(`025`)에서 삭제됐다 — daily-guide는 이제 `care_name`+경과일로 `treatment_guides`를 직접 매칭하고, 매칭이 없으면 그대로 `404 GUIDE_NOT_AVAILABLE`로 폴백된다(위 "public.treatment_guides" 절 참고). **`024`가 `care_records`/`treatment_catalog`의 `care_type`은 지웠지만 이 테이블은 놓쳤던 것을 뒤늦게 발견해 `025`로 별도 정리했다** — 그 전까지는 `server_admin`의 `addCareRecord`가 `care_type`을 전혀 채우지 않는데 컬럼은 `not null`로 남아있어, 회원가입 전(claim 전) 환자에게 시술기록을 등록하는 모든 요청이 NOT NULL 제약 위반으로 실패하는 상태였다
- `store` 컬럼은 v0.6(009)에서 제거됐다(순수 중복 컬럼, `care_records`와 동일한 이유)
- `part_of_body` *(v0.6, 마이그레이션 012)*: 단일 텍스트에서 배열로 변경. 값은 `server_admin`이 정해진 목록(`GET /body-parts`) 안에서만 검증
- `membership_id` *(v0.6, 마이그레이션 011)*: 이 시술기록이 어떤 이용권과 연결됐는지. 시술기록을 삭제할 때 그 이용권 차감을 자동으로 되돌리기 위해 추가(`server_admin/patients.service.ts`) — `(v0.11)` 차감을 안 한 예약이었다면 되돌릴 것도 없으므로 그대로 둔다(아래 `session_consumed` 참고)
- `session_consumed` *(v0.11, 마이그레이션 026)*: `public.care_records`와 동일한 의미 — `careDate`가 등록 시점 기준 오늘(KST)이었는지에 따라 이 시술기록이 실제로 이용권을 차감했는지 기록. 아래 "예약 등록 시 이용권 미차감 지원 (026)" 절 참고

### public.emr_memberships — 계정 연결 전 이용권 *(v0.4 신설 006, v0.6 컬럼 추가 007, v0.9 컬럼 추가 016)*

```sql
create table public.emr_memberships (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.emr_patients(id) on delete cascade,
  product_name text not null,
  total_count int not null default 0,
  used_count int not null default 0,
  remaining_count int generated always as (total_count - used_count) stored,
  expires_at date,
  last_used_at date,
  available_care_names text[] not null default '{}',
  brand text,
  created_at timestamptz not null default now()
);

create index idx_emr_memberships_patient on public.emr_memberships (patient_id);
```

- `public.memberships`와 동일한 형태로 claim 시 그대로 복사됨(단, `remaining_count`는 GENERATED라 claim 시 복사 대상이 아니라 자동 계산됨)
- `expires_at`은 `public.memberships`와 동일하게 v0.7부터 `server_admin`이 생성 시점(첫 시술일+1년)에 채운다
- `brand` *(v0.9, 마이그레이션 016)*: 위 `public.memberships.brand`와 동일한 의미 — claim 전 스테이징 버전. 생성 시 `server_admin`이 로그인 클리닉의 `brand`를 채우며, claim 시 그대로 `memberships.brand`로 복사된다

### public.treatment_catalog — 치료-부위 카탈로그 *(v0.7 신설 013, v0.10 brand 추가+care_type 삭제 021/022/024)*

```sql
create table public.treatment_catalog (
  id uuid primary key default gen_random_uuid(),
  care_name text not null,
  body_parts text[] not null default '{}',
  brand text,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (brand, care_name)
);
```

- 치료명(`care_name`)을 고르면 관리 부위(`body_parts`) 후보를 자동 제안하기 위한 참조 테이블 — `admin-web` 프로토타입의 치료 카탈로그 구조를 반영
- `brand` *(v0.10, 마이그레이션 021)*: **클리닉 공통에서 클리닉별로 전환됐다.** 처음엔(v0.7) "치료 카탈로그는 클리닉마다 다를 이유가 없다"고 판단해 브랜드 구분 없이 전체 공통으로 뒀지만, 실제 엑셀 원본(`docs/care_procedure_template.xlsx`)엔 엠레드/더나/윔 클리닉별로 서로 다른(때로는 겹치는 이름의) 시술 목록이 있었다. `GET /treatment-catalog`(`server_admin`)는 이제 로그인한 관리자의 `brand`(JWT)로 항상 필터링해 자기 클리닉 시술만 보여준다. unique 제약도 `care_name` 단독에서 `(brand, care_name)` 복합으로 바뀌어, 같은 이름의 시술이 서로 다른 클리닉에 각각 존재할 수 있다
- `care_type` 컬럼은 v0.10(`022`에서 nullable화 → `024`에서 완전 삭제)에서 제거됐다. 엑셀 원본 45개 시술 전체를 재시딩하는 과정에서 다수(특히 WIM 클리닉의 웰니스 회복 기기 7종)가 당시 존재하던 7개 `care_type` 어디에도 맞지 않는다는 게 확인됐고, 결국 daily-guide/questions가 `treatment_guides`(시술명 직접 매칭)로 완전히 넘어가며 `care_type` 개념 자체가 불필요해졌다
- `description` *(v0.10 이전부터 존재)*: 시술 설명 — `POST/PATCH /treatment-catalog` 요청 바디의 `description`
- **참조 관계 없음** — 이미 저장된 시술기록/이용권은 카탈로그를 FK로 참조하지 않고 등록 시점 값을 그대로 복사해 쓴다. 카탈로그 항목을 수정/삭제해도 과거 시술기록엔 영향 없음
- `body_parts`(관리 부위 후보)는 프론트 자동완성 제안용일 뿐 `POST .../care-records`의 `partOfBody`를 강제하지 않는다 — `partOfBody`는 이 카탈로그와 무관하게 고정 전체 목록(`GET /body-parts`)에서 항상 다중 선택 가능

### public.admin_accounts — 클리닉별 관리자 로그인 계정 *(v0.6, 마이그레이션 008/009)*

```sql
create table public.admin_accounts (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  password_hash text not null,
  brand text not null,
  created_at timestamptz not null default now()
);
```

- `auth.users`와 무관 — `server_admin`이 자체적으로 bcrypt 해시 + JWT(`ADMIN_JWT_SECRET`)로 인증을 처리한다(Supabase Auth 미사용)
- 클리닉(브랜드)당 계정 1개, 총 3개(AMRED/DERNA/WIM)를 시드 스크립트(`server_admin/db/seed/seedAdmins.ts`)로만 생성 — 가입 API는 없음(클리닉이 3개로 고정)
- 로그인한 계정의 `brand`가 이후 환자 등록·시술기록 추가 시 자동으로 채워지고, 조회도 로그인한 계정의 `brand`로만 격리된다(다른 클리닉 환자/기록은 404로 통일 — 존재 자체를 숨김). `/patients/*` 전체 라우트가 `requireAdminAuth` 미들웨어로 토큰을 요구한다(로그인 없이 항상 열려있던 이전 결정을 뒤집음)
- `store` 컬럼은 v0.6(009)에서 제거됐다(`brand`와 순수 중복)

### public.clinic_doctors — 클리닉별 담당 의료진 목록 *(신설 014)*

```sql
create table public.clinic_doctors (
  id uuid primary key default gen_random_uuid(),
  brand text not null,
  name text not null,
  created_at timestamptz not null default now(),
  unique (brand, name)
);
```

- `GET /clinic-info`(`server_admin`)가 로그인한 관리자의 `brand`로만 조회해 관리 등록 화면의 담당의(`practitioner`) select 후보로 노출한다 — `care_records.practitioner`는 여전히 자유 텍스트라 여기 없는 이름도 입력 가능(강제 아님, 후보 제안일 뿐)
- 카카오톡 상담 링크/전화번호는 별도 `clinics` 테이블을 새로 만들지 않고 `public.businesses`(015)를 그대로 재사용한다 — 같은 목적의 데이터를 중복 관리하지 않기 위함

### ~~public.signup_verification_codes~~ — 제거됨 (v0.4 신설 006 → v0.6 삭제 010)

가입 시 환자번호와 함께 대조하던 24시간 유효 인증코드를 저장하던 테이블. v0.6(010)에서 회원가입 신원확인 방식이 "인증코드 발급·대조"에서 "환자번호+이름+생년월일 일치 대조"로 단순화되며 더 이상 쓰이지 않게 되어 테이블 자체를 삭제했다.

---

## 설계 결정 (테이블을 일부러 안 만든 것들)

| 결정 | 이유 |
|---|---|
| **추천(Recommendation) 테이블 없음** | 규칙 기반이라 매 요청 시 `care_records`+`memberships`+`profiles.interest_goals`로 즉석 계산. `recommendationId`는 응답 시점에 생성해 상세조회 라우팅에만 사용 |
| **refresh token 테이블 없음** | Supabase Auth가 내부 관리. `POST /auth/refresh`·`/logout`은 Supabase SDK 호출로 대체 |
| **알림 설정은 profiles 컬럼** | 사용자당 1행이라 별도 테이블 정규화 이득 없음. 항목이 늘어나면 그때 분리 |
| **캘린더는 집계 쿼리** | `care_records`를 월 단위로 `GROUP BY`. 별도 마커 테이블 유지 비용 없음 |
| ~~**하루 1회 LLM 생성은 DB 제약으로**~~ *(v0.10에서 무의미해짐)* | `aftercare_guides`의 UNIQUE로 애플리케이션 로직 실수를 DB가 방어하던 결정이었으나, daily-guide가 더 이상 LLM을 호출하지 않아(`treatment_guides` 직접 조회) 테이블째 삭제되며 이 결정 자체가 사라짐 |
| **알림 중복 발송은 DB 제약으로** *(v0.10)* | `notification_log`의 `unique (type, ref_id, ref_key)`로 크론이 겹쳐 돌아도 중복 발송을 DB가 방어 — 위 "하루 1회 LLM 생성" 결정과 같은 패턴을 알림 발송에 재사용 |
| **전화 인증은 미구현으로 제거** | 국내 SMS 업체 연동 비용이 MVP 범위 밖이라 판단, `phone_verifications` 테이블·`phoneVerifiedToken` 흐름 전부 삭제(`004_remove_phone_verification.sql`) |
| **알러지·의사코멘트는 별도 테이블(`medical_profiles`)로 분리** | `profiles`(앱 계정 데이터)와 성격이 달라 접근 권한·감사 로그를 다르게 관리하기 위함. EMR 동기화 대상이라는 점도 명확히 구분 |
| **의료정보 접근은 감사 로그(`medical_data_access_log`) 필수** | 알러지·의사 코멘트가 민감정보라 "누가/언제/왜" 봤는지 남겨야 함. LLM이 컨텍스트로 읽을 때도 기록 |
| **`relatedRecentCares`/`categoryTags`/`clinicContacts` 전용 테이블 없음** *(v0.3, categoryTags는 v0.15에서 popularWithSimilarCustomers를 대체)* | 추천 상세 화면(`api-spec.md` v0.5)의 확장 필드들이지만 각각 `care_records` 최신 N건 조회, 추천된 시술의 `procedures.category_tags` 그대로 노출, `businesses` 연락처 조회로 즉석 계산 가능해 저장할 필요가 없음 — 기존 "추천 테이블 없음" 결정과 같은 이유 |
| **비밀번호 재설정/변경 전용 테이블 없음** *(v0.3)* | Supabase Auth가 재설정 토큰 발급·검증·비밀번호 해싱을 전담. 전화 인증과 달리 국내 제약이 없어 자체 구현 불필요 |
| **가상 EMR 스테이징 테이블은 `auth.users`와 완전히 분리** *(v0.4)* | `emr_patients` 등 4종은 `server_admin`이 다루는 "계정 연결 전" 데이터라 고객용 테이블(`profiles`/`care_records`/`memberships`)과 독립적으로 존재. claim(회원가입) 시점에만 1회성으로 실제 테이블로 복사되며, 이후 EMR 테이블에 추가된 데이터는 자동 동기화되지 않는다(의도적 범위 제한 — 실제 서비스라면 배치 ETL 필요) |
| **관리자 로그인은 Supabase Auth가 아니라 자체 bcrypt+JWT** *(v0.6, 008)* | 클리닉 계정 3개가 고정이라 가입 플로우 자체가 필요 없고(시드 스크립트로만 생성), 고객용 `auth.users`와 완전히 다른 성격의 인증(브랜드별 격리)이라 별도 테이블+토큰 체계로 분리하는 편이 단순함 |

## 알려진 트레이드오프

- 스키마가 고정적 — 컬럼 추가/변경 시 마이그레이션 필요 (Prisma 등으로 빠르게 처리 가능)
- Supabase 무료 플랜은 장기간 미접속 시 프로젝트가 자동 일시정지(pause)됨 — 데모 전날 접속 확인 필요
- 클라이언트가 DB에 직접 붙는 패턴을 쓸 경우 Row Level Security(RLS) 미설정 시 다른 사용자 데이터 노출 위험. 지금 구조(백엔드 서버가 인증된 `user_id`로 필터링)에서는 해당 위험이 낮음
- 실제 서비스로 갈 경우 클리닉 EMR과의 연동은 별도 법적 검토(개인정보 제3자 제공/위탁 동의, 의료법 관련 규정)가 필요함 — MVP는 가상 데이터 시드로 이 부분을 우회하지만, 프로덕션 전환 시 반드시 확인해야 할 항목

## v0.3에서 추가된 항목 (와이어프레임 검토 반영, 마이그레이션 적용 완료)

`api-spec.md` v0.5 대응. **`server/db/migrations/003_v05_wireframe_features.sql`이 Supabase 프로젝트에 실제 적용됐고, `npm run seed` 재시드까지 완료해 아래 컬럼/테이블에 데모 데이터가 채워진 상태를 직접 조회로 확인했다.**

| 변경 | 대상 | 비고 |
|---|---|---|
| 컬럼 추가 | `profiles.birth_date`, `profiles.marketing_alert` | `marketing_alert`는 이후 005에서 삭제됨(아래 참고) |
| 컬럼 추가 | `care_records.status`, `session_number`, `total_sessions`, `membership_id` | 마이그레이션 003은 `memberships`가 001_init.sql에서 이미 생성돼 있다는 전제로 FK를 바로 추가한다(순서 주의, 위 "마이그레이션 순서 주의" 참고) |
| 신규 테이블 | `public.membership_usages` | 이용권 회차별 사용 이력 |
| 신규 테이블 없음 | 비밀번호 재설정/변경 | Supabase Auth 위임 |
| 신규 테이블 없음 | 추천 상세 확장 필드 3종 | 기존 테이블 조합으로 즉석 계산 |

이미 001·002·003 순서로 적용된 프로젝트 기준이다. 아직 마이그레이션을 실행하지 않은 다른 환경(예: 신규 클론)이라면 `server/db/migrations/*.sql`을 001부터 순서대로 Supabase SQL Editor(또는 `supabase db push`)로 실행하면 된다.

## 전화번호 SMS 인증 제거 (004)

`server/db/migrations/004_remove_phone_verification.sql` — 국내 SMS 업체 연동이 MVP 범위 밖으로 확정되며 관련 스키마를 걷어냈다.

| 변경 | 대상 | 비고 |
|---|---|---|
| 테이블 삭제 | `public.phone_verifications` | OTP 코드 해시·오입력 횟수 저장용이었던 독립 테이블 |
| 컬럼 삭제 | `profiles.phone_verified_at` | `phone` 컬럼 자체와 unique 제약은 유지 |

이 마이그레이션은 아직 Supabase 프로젝트에 적용되지 않았다면 Supabase SQL Editor에서 직접 실행해야 한다.

## 알림 설정 제거 (005)

`server/db/migrations/005_remove_notification_settings.sql` — `push_enabled`/`aftercare_reminder`/`membership_expiry_alert`/`marketing_alert` 4개 컬럼 모두 저장만 될 뿐 실제로 읽어 분기하는 발송 로직이 없는 placeholder였다(발송 스케줄러 자체가 미구현). `GET`/`PATCH /notifications/settings` 엔드포인트를 걷어내며 컬럼도 함께 삭제했다.

| 변경 | 대상 | 비고 |
|---|---|---|
| 컬럼 삭제 | `profiles.push_enabled`, `profiles.aftercare_reminder`, `profiles.membership_expiry_alert`, `profiles.marketing_alert` | `device_tokens` 테이블(FCM 토큰)은 실제로 쓰이므로 그대로 유지 |

이 마이그레이션도 아직 Supabase 프로젝트에 적용되지 않았다면 Supabase SQL Editor에서 직접 실행해야 한다.

## 가상 EMR 스테이징 테이블 추가 (006)

`server/db/migrations/006_add_admin_emr_staging_tables.sql` — **Supabase 프로젝트에 실제 적용 완료.** 실제 클리닉처럼 "환자가 앱에 가입하기 전에 의료진이 먼저 시술 이력을 입력해둔다"는 흐름을 지원하기 위해, 회원가입 방식을 이메일/비밀번호 자유 가입에서 **환자번호+인증코드 기반 가입**으로 교체하며 함께 추가된 마이그레이션이다.

| 변경 | 대상 | 비고 |
|---|---|---|
| 신규 테이블 | `public.emr_patients` | 환자 프로필. `auth.users`와 무관하게 독립 존재, `claimed_user_id`로 가입 완료 여부 표시 |
| 신규 테이블 | `public.emr_care_records` | 계정 연결 전 시술 이력. claim 시 `care_records`로 이관 |
| 신규 테이블 | `public.emr_memberships` | 계정 연결 전 이용권. claim 시 `memberships`로 이관 |
| 신규 테이블 | `public.signup_verification_codes` | 24시간 유효 가입 인증코드. `server_admin`이 발급, `POST /auth/signup`이 검증·소진 |

**배경(설계 대안 기각 사유)**: 처음엔 "이미 가입된 계정 위에 EMR 데이터를 얹는" 방식(placeholder Auth 계정을 미리 만들어두는 안)을 검토했으나 (1) 나중에 진짜 가입 시 별개 계정이 생겨 매칭이 안 되고 (2) 기존 `PHONE_ALREADY_EXISTS` 체크가 오히려 진짜 가입을 막으며 (3) `medical_profiles.user_id`가 PK라 계정 이관 시 PK 스왑이 필요하다는 세 가지 문제로 기각됐다. "환자번호+인증코드로 신원확인 후 가입" 방식이 이 세 문제를 모두 해결한다.

**관리자용 신규 스택**: 관리자 웹(`admin-web`, 별도 GitHub 저장소)과 그 백엔드 `server_admin/`(포트 4100, `server/`와 동일 컨벤션)이 이 마이그레이션과 함께 추가됐다. `server_admin`은 이 테이블들만 다루고 `server/`의 기존 고객용 테이블은 건드리지 않는다. *(이 시점엔 "로그인 없이 항상 열림"이 데모 범위 결정이었으나, v0.6(008)에서 클리닉별 로그인이 추가되며 뒤집혔다 — 아래 007~012 절 참고.)*

이 마이그레이션은 이미 Supabase 프로젝트에 적용됐다. 아직 적용하지 않은 다른 환경(신규 클론 등)이라면 Supabase SQL Editor에서 직접 실행해야 한다.

## emr_memberships 잔여횟수 생성 컬럼 추가 (007)

`server/db/migrations/007_emr_membership_remaining_count.sql` — `public.memberships`와 동일한 패턴으로 `emr_memberships.remaining_count`를 GENERATED 컬럼으로 추가. 시술기록 추가 화면의 "이 이용권 몇 회 남았는지" 토글 목록에서 `total_count - used_count`를 매번 계산하지 않아도 되도록 DB가 항상 최신값을 들고 있게 한다.

## 클리닉 관리자 로그인 추가 (008)

`server/db/migrations/008_add_admin_accounts.sql` — admin-web에 로그인 화면을 추가하기로 결정 변경(기존 "무인증 데모" 결정을 뒤집음). `public.admin_accounts` 신규 — 클리닉(브랜드)마다 계정 1개씩 총 3개(AMRED/DERNA/WIM)를 시드 스크립트로 미리 만들어 둔다. 로그인한 계정의 brand/store가 이후 시술기록 추가 시 자동으로 채워지고, 조회도 로그인한 계정의 brand로 격리된다.

## store 컬럼 제거 + emr_patients.brand 추가 (009)

`server/db/migrations/009_drop_store_add_patient_brand.sql` — `store`는 클리닉당 지점이 1곳뿐이라 `brand`와 항상 1:1이었던 순수 중복 컬럼이라 판단해 `care_records`/`emr_care_records`/`admin_accounts`에서 전부 제거. 동시에 클리닉 관리자 로그인(008)으로 "로그인한 클리닉의 환자만 보인다"는 격리 규칙이 필요해져, 지금까지 소속 클리닉 정보가 없던 `emr_patients`에 `brand` 컬럼을 추가(환자 등록 시점에 로그인한 관리자의 brand를 기록).

| 변경 | 대상 | 비고 |
|---|---|---|
| 컬럼 삭제 | `care_records.store`, `emr_care_records.store`, `admin_accounts.store` | `brand`와 순수 중복 |
| 컬럼 추가 | `emr_patients.brand` | nullable로 추가(백필 필요) |

## 인증코드 발송 제거 + 환자 등록 필드 통합 (010)

`server/db/migrations/010_signup_identity_check_and_patient_notes.sql` — 두 가지 변경을 함께 적용:
1. 회원가입 인증코드 발급/확인 절차를 없애고, `patientNo`+이름+생년월일 일치 여부로 신원을 확인하는 방식으로 전환. `signup_verification_codes` 테이블은 더 이상 쓰이지 않아 삭제
2. 환자 등록 입력을 이름/생년월일/전화번호/기타사항(알러지·기저질환·의사소견을 통합한 자유입력) 4개로 단순화 — `emr_patients`의 `allergies`/`chronic_conditions`/`doctor_general_comment` 3개 컬럼을 `notes` 하나로 통합

| 변경 | 대상 | 비고 |
|---|---|---|
| 테이블 삭제 | `public.signup_verification_codes` | 인증코드 발급 절차 자체가 없어짐 |
| 컬럼 추가 | `emr_patients.notes` | claim 시 `medical_profiles.doctor_general_comment`로 이관 |
| 컬럼 삭제 | `emr_patients.allergies`, `chronic_conditions`, `doctor_general_comment` | `notes`로 통합 |

## emr_care_records ↔ emr_memberships 연결 (011)

`server/db/migrations/011_care_record_membership_link.sql` — 시술기록과 이용권이 함께 만들어져도 서로를 가리키는 FK가 없어, 시술기록을 지울 때 이용권 차감을 되돌릴 방법이 없었다. `emr_care_records.membership_id`로 연결해 시술기록 삭제 시 이용권도 자동으로 정리(차감 취소 또는 이용권 자체 삭제)할 수 있게 했다(`server_admin/patients.service.ts`).

## 관리 부위 배열화 (012)

`server/db/migrations/012_care_record_body_parts_array.sql` — 관리 상세 화면(와이어프레임 11번)처럼 한 시술이 여러 부위에 동시에 이뤄질 수 있어(예: "이마+미간"), `care_records.part_of_body`/`emr_care_records.part_of_body`를 단일 텍스트에서 배열(`text[]`)로 변경. 값은 정해진 부위 목록 중에서만 고를 수 있도록 `server_admin`이 검증한다(`GET /body-parts`로 목록 노출). 데모 단계라 기존 값은 보존하지 않고 컬럼을 재생성했다(재시드 필요).

## 치료-부위 카탈로그 추가 (013)

`server/db/migrations/013_add_treatment_catalog.sql` — 관리자 웹 프로토타입(`docs/WHS_After_Mate_Admin_revised.html`)의 "치료명 고르면 관리 부위 자동 채움" 방식을 도입하기 위해 `public.treatment_catalog` 신규 추가(위 테이블 정의 참고). 이와 함께 `server_admin`의 이용권 처리 로직도 두 가지 변경:

- **이용권 만료일 실제 적용** — `memberships`/`emr_memberships`의 `expires_at` 컬럼은 001부터 있었지만 그동안 `server_admin`이 값을 넣지 않아 항상 `null`이었다. 이제 새 이용권을 만들 때 그 시술 날짜(`careDate`) 기준 +1년으로 계산해 채우고, 차감 시 만료 여부를 확인해 만료됐으면 `409 MEMBERSHIP_EXPIRED`로 거부한다(DB 스키마 변경 없음, 애플리케이션 로직만 추가)
- **이용권 자동 이어쓰기** — `POST .../care-records`에 `totalSessions`(직접입력)로 요청하면, 같은 `product_name`+같은 `total_count`로 아직 유효한(소진·만료 안 된) 이용권이 있는지 먼저 찾아서 있으면 새로 만들지 않고 그 이용권에 이어서 차감한다(관리자 프로토타입의 "패키지 자동 이어쓰기" 동작 재현)

자세한 API 계약은 `docs/admin-api-spec.md` v0.3 참고.

## 실제 사업장/시술 카탈로그 추가 (015)

`server/db/migrations/015_add_care_catalog.sql` — 사용자가 실제 사업장 데이터(`docs/care_procedure_template.xlsx` — 엠레드/더나/윔 3곳, 실시술 46종 + concernTag 매칭, `docs/care_recommendation_data_guide.md`에 설계 문서)를 전달하면서, 다음 관리 추천(`recommendations.service.ts`) 로직이 실데이터를 전혀 참조하지 않던 문제가 드러나 신규 테이블 `public.businesses`/`public.procedures`를 추가하고(위 테이블 정의 참고) 추천 알고리즘을 전면 교체했다.

- 실데이터는 `server/db/seed/seedCareCatalog.ts`(`npm run seed:care-catalog`)로 반영 — 사업장 3곳(카카오톡/전화번호 포함) + 시술 46종(엠레드 19/더나 20/윔 7)
- **기존**: 추천 후보 = 고객이 보유한 이용권(`memberships.availableCareNames`) 안에서만 선택. **변경 후**: 추천 후보 = `procedures` 테이블 전체(이용권 보유 여부 무관), 고객의 `profiles.interest_goals`와 시술의 `category_tags`가 겹치는 것 우선 추천
- concernTag 고정 10종은 `server/src/lib/concernTags.ts`에 상수로 관리(DB 테이블 아님) — 앱의 관심목표 칩과 동일한 값이어야 매칭됨
- `treatment_catalog`(013)와는 별개 테이블이다 — `treatment_catalog`는 `care_type`/부위 기반으로 관리자 웹의 시술기록 등록 자동완성에 쓰이고, `procedures`는 `category_tags`(concernTag) 기반으로 고객 추천에 쓰인다. 실제로는 두 카탈로그에 겹치는 시술이 있을 수 있지만(예: "울쎄라피 프라임") 아직 통합하지 않았다
- 실계정으로 라이브 검증 완료 — 자세한 API 계약 변경은 `docs/api-spec.md` v0.8 참고
- 참고: 같은 날 별도로 진행하던 `treatment_catalog.description` 컬럼 + `clinic_doctors` 테이블 작업(`014_add_treatment_description_clinic_info_doctors.sql`)은 이 변경과 무관하다 — **이 문서엔 오랫동안 "보류 상태(마이그레이션 미적용)"로 잘못 기록돼 있었지만, 실제로는 적용 완료 상태이며 `GET /clinic-info`로 이미 쓰이고 있다** (아래 "public.clinic_doctors" 절 참고, 발견 시점: db-schema.md v0.10 갱신 중)

## 이용권에 브랜드 컬럼 추가 (016)

`server/db/migrations/016_add_membership_brand.sql` — 앱 연동 중 "이 이용권이 어느 클리닉 것인지 구분해야 한다"는 요청(`GET /memberships` 응답에 `brand` 필요)이 들어와, `public.memberships`/`public.emr_memberships`에 `brand text` 컬럼을 추가했다(위 두 테이블 정의 참고).

- `care_records`/`emr_care_records`는 처음부터(001/006) `brand`를 갖고 있었지만, 짝을 이루는 이용권 테이블엔 없었다 — 이 프로젝트는 "이용권 추가"라는 별도 행위가 없고 항상 시술기록과 함께 생성되므로(`server_admin`의 `addCareRecord`), 만들어질 때의 `brand`를 그대로 함께 저장하면 된다
- **기존 행 백필**: `membership_id`로 연결된 `care_records`/`emr_care_records` 중 가장 먼저 만들어진 기록의 `brand`를 그대로 가져온다 — 모든 이용권이 시술기록에서 파생되므로 백필 커버리지는 항상 100%
- **정책 변경 아님**: `brand`는 순수 표시용 메타데이터다. 이용권 차감/자동 이어쓰기 매칭(`findContinuableMembership`)은 지금과 동일하게 `product_name`+`total_count`만으로 판단하며 `brand`를 조건에 넣지 않는다 — "이용권은 클리닉별로 격리되지 않는다"는 기존 정책은 이번 변경으로 바뀌지 않았다(계속 알려진 제한사항으로 남음)
- 관리자 웹(`server_admin`)의 `GET /patients/{patientId}`는 `memberships`/`emr_memberships`를 `SELECT *`로 그대로 반환하므로, 코드 변경 없이 이 컬럼이 응답에 자동으로 포함된다
- 마이그레이션 자체는 이 세션에서 코드까지 완료했지만, DDL 실행 권한(Postgres 직접 연결)이 없어 **Supabase SQL Editor에 수동 적용 필요** — 적용 전까지는 `brand` 컬럼이 없어 관련 INSERT가 실패한다

## 질문 상담 필요도 컬럼 추가 (017)

`server/db/migrations/017_add_question_consultation_level.sql` — 위 "public.questions" 절 참고. `status`(답변했는지 여부)와 별개로 "실제 상태 확인이 필요한 정도"(`NONE`/`RECOMMENDED`/`URGENT`)를 LLM이 함께 판단해 저장한다.

## daily-guide 콘텐츠 구조 재설계 (018)

`server/db/migrations/018_daily_guide_docx_redesign.sql` — `docs/prompt.docx` 재설계에 맞춰 (당시) `aftercare_guides`의 `must_avoid`/`basic_care` 컬럼을 `precautions`/`aftercare`로 rename하고 `key_care`(오늘 가장 중요한 한 줄 요약) 컬럼을 추가했다. 이 컬럼 이름(`aftercare`/`precautions`/`key_care`)이 그대로 아래 `treatment_guides`(023)에 이어져, 지금의 daily-guide 응답 구조가 됐다. **`aftercare_guides` 테이블 자체는 024에서 삭제**됐으므로 이 마이그레이션이 만든 컬럼은 더 이상 존재하지 않는다 — 이름 변경 이력만 참고용으로 남긴다.

## care_type 제거 + treatment_guides 도입 (019~025)

daily-guide/questions 두 LLM 호출 지점 모두 `care_type` 그룹 단위 검수 가이드(`reference_guides`)를 근거로 쓰던 구조를, 시술마다 실제 사후관리 내용이 다르다는 문제(장비·성분 차이) 때문에 시술명(`care_name`) 직접 매칭 콘텐츠(`treatment_guides`)로 전면 교체한 작업. FCM 푸시 알림 인프라 구축과 같은 세션에서 함께 진행됐다.

| 마이그레이션 | 변경 |
|---|---|
| `019_add_notification_settings.sql` | `profiles`에 `care_notification`/`marketing_notification` 컬럼 추가 — 005에서 걷어냈던 알림 설정을 실제로 동작하는 형태로 재도입 |
| `020_add_notification_log.sql` | `public.notification_log` 신규 — 알림 종류별 중복 발송 방지(unique 제약)+감사 기록 |
| `021_add_treatment_catalog_brand.sql` | `treatment_catalog`에 `brand` 컬럼 추가, unique 제약을 `care_name` 단독에서 `(brand, care_name)` 복합으로 교체 — 클리닉별 시술 카탈로그 격리 |
| `022_treatment_catalog_care_type_nullable.sql` | `treatment_catalog.care_type`을 nullable로 완화 — 엑셀 45개 시술 전체 재시딩 중 다수가 기존 7개 `care_type` 어디에도 안 맞는다는 게 확인돼, 억지로 끼워맞추는 대신 매칭되는 것만 채우고 나머지는 null 허용 |
| `023_add_treatment_guides.sql` | `public.treatment_guides` 신규(위 절 참고) — `care_type` 그룹 매칭을 시술명+경과일(1/3/5/7/14) 직접 매칭으로 교체 |
| `024_drop_care_type.sql` | `care_records`/`treatment_catalog`의 `care_type` 컬럼과 `reference_guides`/`aftercare_guides` 테이블을 전부 삭제 — 애플리케이션 코드에서 참조가 완전히 제거된 걸 확인한 뒤 실행 |
| `025_drop_emr_care_records_care_type.sql` | `emr_care_records.care_type` 삭제 — 024가 놓쳤던 것을 문서 정합성 점검 중 발견. 이 컬럼이 `not null`로 남아있는데 `server_admin`의 `addCareRecord`가 값을 전혀 안 채우고 있어, 회원가입 전(claim 전) 환자에게 시술기록을 등록하는 모든 요청이 실패하는 상태였다 |

**결과적으로 daily-guide는 더 이상 LLM을 호출하지 않는다** — `treatment_guides`를 시술명+경과일로 직접 조회해 즉시 응답하고, 매칭이 없으면 LLM 폴백 없이 바로 `404 GUIDE_NOT_AVAILABLE`. LLM 호출 지점은 이제 `questions`(챗봇, 근거만 `reference_guides`→`treatment_guides`로 교체)와 `recommendations`(다음 관리 추천) 두 곳뿐이다.

이 배치의 마이그레이션들은 전부 Supabase 프로젝트에 적용 완료됐다(직접 조회로 확인) — `025`도 이후 세션에서 적용 완료.

## 예약 등록 시 이용권 미차감 지원 (026)

`server/db/migrations/026_add_care_record_session_consumed.sql` — 실사용 중 발견된 문제: 시술기록을 등록하는 순간(`careDate`가 미래든 과거든 상관없이) 항상 이용권 1회를 즉시 차감하고 있었다. 그 결과 같은 패키지로 여러 미래 예약을 잡으면(예: 오늘 다음주 보톡스 3회권 예약 + 내일 다다음주 3회권 예약) 아직 시술을 하나도 안 받았는데 이용권이 먼저 소진되는 문제가 있었다.

`care_records`/`emr_care_records`에 `session_consumed boolean`(기본값 `true`, 이 기능 도입 이전 기존 행 백필용) 컬럼을 추가하고, `server_admin`의 `addCareRecord()`를 다음과 같이 바꿨다:

- `careDate`가 등록 시점 기준 오늘(KST)이면 → 기존과 동일하게 이용권 즉시 차감(`session_consumed: true`)
- 그 외(미래 예약이든 과거 소급 등록이든) → 이용권을 연결만 하고 `used_count`는 그대로 둔다(`session_consumed: false`). 새 이용권을 만드는 경우도 `used_count: 0`, `last_used_at: null`로 시작
- 같은 `product_name`+`total_count`로 여러 번 미래 예약을 잡아도 `findContinuableMembership`이 계속 같은(아직 `used_count < total_count`인) 이용권을 찾아내므로, 미소비 예약들은 전부 이용권 하나를 공유한다
- `DELETE /care-records/{id}`도 `session_consumed`를 확인해서, 차감 안 했던 예약을 지울 땐 `used_count`를 되돌리지 않는다(되돌리면 다른 기록의 진짜 차감분을 훼손하게 됨)
- **부수 효과 — `session_number` 재계산**: 같은 이용권에 걸린 미소비 예약들의 회차 번호가 등록 시점에 고정되지 않고, 이용권 상태가 바뀔 때마다(차감/차감취소/새 예약추가) 관리날짜 순으로 다시 매겨진다(`resyncUnconsumedSessionNumbers`). 이전엔 저장된 값이 그대로 굳어있어서, 미래 예약을 먼저 잡아두고 그 전에 실제 시술을 하나 더 받아도 예약의 회차 번호가 그대로 남아있는 버그가 있었다(예: 3회권 중 미래 예약을 1회차로 저장해뒀는데, 그 전에 실제 시술로 1회차를 소비해도 예약은 계속 1회차로 보임 — 2회차로 안 바뀜)

자세한 API 계약은 `docs/admin-api-spec.md` v0.11 참고.

## 회원 탈퇴 시 병원 데이터 보존 지원 (027)

`server/db/migrations/027_add_membership_external_record_id.sql` — 신규 `DELETE /profile`(회원 탈퇴, `docs/api-spec.md` v0.19)가 가입 이후 병원에서 쌓인 시술기록/이용권을 삭제 전에 `emr_care_records`/`emr_memberships`로 되돌려 보존하려면, "이 `memberships` 행이 이미 emr에 원본이 있는 이관분인지, 가입 후 새로 생긴 신규분인지" 구분할 수 있어야 한다. `care_records`는 001부터 `external_record_id` 컬럼이 있어 그대로 재사용할 수 있었지만 `memberships`엔 대응하는 컬럼이 없어 이번에 추가했다(위 "public.memberships" 절 참고). 기존 행은 출처를 알 수 없어 `null`로 남는다 — 탈퇴 로직은 이 경우 "가입 후 신규"로 취급해 새 `emr_memberships` 행을 만든다(데이터 유실보다 안전한 방향).
