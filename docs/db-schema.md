# WHS After Mate — DB 스키마 (v0.7)

기준: `api-spec.md` v0.6, `admin-api-spec.md` v0.3. **PostgreSQL (Supabase)** 사용 — 계정·비밀번호·토큰은 Supabase Auth(`auth.users`)에 위임하고, 앱 데이터는 `public` 스키마에 직접 구성한다. 전화번호 SMS 인증은 국내 SMS 업체 연동 비용 때문에 MVP 범위 밖으로 확정되어 제거됐다(`server/db/migrations/004_remove_phone_verification.sql`) — `phone`은 이제 조회·표시용 연락처 값일 뿐이다.

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
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

| 컬럼 | 설명 |
|---|---|
| `user_id` | PK, `auth.users(id)` 참조, 계정 삭제 시 CASCADE |
| `birth_date` | *(v0.3 신규)* 내 정보 화면의 생년월일. `GET /profile` 응답 `birthDate` |
| `interest_goals` | 관심 목표 — 추천 API(`basis: goal`)의 입력값 |

→ `GET/PATCH /profile`, `PUT /profile/interests` 모두 이 한 테이블로 처리.
→ `phone`은 기존부터 있던 컬럼(가입 시 입력한 연락처)이며, `GET /profile` 응답에 `phone` 필드로 노출하는 것 자체는 v0.5에서 새로 추가된 것이지 컬럼 자체는 신규가 아니다. `phone_verified_at` 컬럼은 전화인증 기능 제거와 함께 삭제됐다(`004_remove_phone_verification.sql`).
→ `push_enabled`/`aftercare_reminder`/`membership_expiry_alert`/`marketing_alert` 컬럼은 실제로 읽어 분기하는 발송 로직이 없는 placeholder였던 `GET/PATCH /notifications/settings` 엔드포인트와 함께 삭제됐다(`005_remove_notification_settings.sql`).

### ~~public.phone_verifications~~ — 제거됨

전화번호 SMS 인증 기능 자체를 MVP 범위 밖으로 확정하며 `004_remove_phone_verification.sql`로 테이블을 삭제했다. 원래는 가입 전 단계(계정과 미연결)의 OTP 코드 해시·오입력 횟수·재요청 주기 제한을 저장하던 독립 테이블이었다.

### public.care_records — 클리닉 EMR에서 동기화된 시술 이력

```sql
create table public.care_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  care_name text not null,
  care_type text,
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
  created_at timestamptz not null default now()
);

create index idx_care_records_user_date
  on public.care_records (user_id, care_date desc);

create unique index idx_care_records_external_id
  on public.care_records (external_record_id)
  where external_record_id is not null;
```

- `care_type`: `reference_guides.care_type`과 매칭하는 내부 정규화 키(예: `peeling`, `laser_toning`). `care_name`은 사용자에게 보여주는 표시용 문자열이라 매칭 키로 쓰기 부적절해 별도 컬럼으로 분리. API 응답에는 노출하지 않음 (서버 구현 시 추가)
- `part_of_body` *(v0.6, 마이그레이션 012)*: 텍스트 단일값에서 배열로 변경 — 한 시술이 여러 부위에 동시에 이뤄질 수 있어(예: "이마+미간") 중복 선택 가능하게 함. `emr_care_records`도 동일하게 배열
- `store` 컬럼은 v0.6(009)에서 제거됐다 — 클리닉당 지점이 하나뿐이라 `brand`와 항상 1:1이었던 순수 중복 컬럼
- `status` *(v0.3, 마이그레이션 003)*: `GET /care-records`/`{id}` 응답의 `status`. 기본값 `completed`(EMR 동기화 데이터는 이미 끝난 시술 위주)
- `session_number` / `total_sessions` *(v0.3, 마이그레이션 003)*: 관리 상세의 "관리 회차: 2/3회차". nullable — 회차 개념이 없는 단건 시술은 비워둠
- `membership_id` *(v0.3, 마이그레이션 003)*: 이 시술이 차감한 이용권 FK. `on delete set null`로 이용권이 삭제돼도 시술 기록 자체는 보존. **마이그레이션 순서 주의**: `public.memberships`가 먼저 생성되어 있어야 하므로, 실제 적용 시 이 테이블 정의를 `memberships` 다음으로 옮기거나 `ALTER TABLE ... ADD COLUMN membership_id ...`를 memberships 생성 후 별도 스텝으로 분리해야 한다(문서 내 테이블 순서는 설명 편의상 EMR 연동 그룹을 앞에 둔 것)
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
  created_at timestamptz not null default now()
);

create index idx_memberships_user_expiry
  on public.memberships (user_id, expires_at);
```

- `remaining_count`는 GENERATED 컬럼 — 직접 갱신 불필요, `used_count`만 늘리면 자동 계산됨
- `expires_at` *(컬럼 자체는 001부터 존재, v0.7부터 `server_admin`이 실제로 채움)*: `server_admin`이 이용권을 새로 만들 때 그 시술 날짜(`careDate`) 기준 +1년으로 계산해 넣는다(이어서 차감할 때는 재계산하지 않음). 만료 후 차감 시도는 `server_admin` 서비스 레이어에서 거부(`MEMBERSHIP_EXPIRED`) — DB 제약이 아니라 애플리케이션 레벨 검증

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

### public.aftercare_guides — LLM 일차별 가이드 캐시

```sql
create table public.aftercare_guides (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  care_record_id uuid not null references public.care_records(id) on delete cascade,
  days_elapsed int not null,
  elapsed_range text,
  must_avoid text[] not null default '{}',
  basic_care text[] not null default '{}',
  next_check_date date,
  generated_at timestamptz not null default now(),
  generated_by text not null default 'llm',
  generated_date date generated always as
    ((generated_at at time zone 'Asia/Seoul')::date) stored,
  cache_expires_at timestamptz not null,
  unique (care_record_id, generated_date)
);
```

- `unique (care_record_id, generated_date)`: **"하루 1회 LLM 생성"** 규칙을 애플리케이션 코드가 아니라 DB 제약으로 강제 — 동시 요청이 겹쳐도 같은 날 중복 생성이 DB 단에서 거부됨
- `generated_date`는 `generated_at`에서 파생된 GENERATED 컬럼 (한국 시간 기준 자정 캐시 만료와 맞추기 위함)

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
  created_at timestamptz not null default now()
);

create index idx_questions_user_created
  on public.questions (user_id, created_at desc);
```

- `care_record_id`는 nullable — 관리 이력이 삭제돼도 질문 이력 자체는 남긴다(`on delete set null`)
- `status` CHECK 제약으로 `POST /aftercare/questions`의 세 가지 상태값만 허용

### public.reference_guides — 검수된 관리 가이드 (RAG 소스, 서버 구현 시 신규)

```sql
create table public.reference_guides (
  id uuid primary key default gen_random_uuid(),
  care_type text not null,
  elapsed_range_start int not null,
  elapsed_range_end int not null,
  elapsed_range_label text not null,
  must_avoid text[] not null default '{}',
  basic_care text[] not null default '{}',
  next_check_offset_days int,
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (care_type, elapsed_range_start, elapsed_range_end)
);
```

- `llm-prompt-design.md`의 "미확정 사항"이었던 "검수 가이드 저장 형식/위치"를 DB 테이블로 확정. daily-guide/questions 두 LLM 호출 지점 모두 이 테이블을 `care_type`+`days_elapsed` 구간으로 조회해 유일한 사실 근거로 주입
- 정적 파일이 아닌 테이블로 택한 이유: 관리 유형×경과구간 조합이 적어(수십 건 이내) 운영 중 검수자가 직접 값을 수정하기 쉬움

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

- Android 클라이언트가 발급받은 FCM 토큰을 `POST /notifications/device-token`으로 등록. 알림 실제 발송(아침 리마인더 등)은 MVP 범위 밖이라 발송 함수만 준비

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

### public.emr_care_records — 계정 연결 전 시술 이력 *(v0.4 신설 006, v0.6 컬럼 개편 009/011/012)*

```sql
create table public.emr_care_records (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.emr_patients(id) on delete cascade,
  care_name text not null,
  care_type text not null,
  care_date date not null,
  part_of_body text[] not null default '{}',
  brand text,
  practitioner text,
  basic_aftercare_guide text[] not null default '{}',
  doctor_comment text,
  session_number int,
  total_sessions int,
  membership_id uuid references public.emr_memberships(id) on delete set null,
  created_at timestamptz not null default now()
);

create index idx_emr_care_records_patient on public.emr_care_records (patient_id, care_date desc);
create index idx_emr_care_records_membership on public.emr_care_records (membership_id);
```

- 컬럼 구성은 `public.care_records`와 거의 동일 — claim 시 그대로 복사되기 때문. `care_type`은 `reference_guides`와 매칭되는 값(현재 `peeling`/`laser_toning`)만 실제 일차별 가이드가 생성되고, 그 외 값은 클레임 후 `404 GUIDE_NOT_AVAILABLE`로 안전하게 폴백된다
- `store` 컬럼은 v0.6(009)에서 제거됐다(순수 중복 컬럼, `care_records`와 동일한 이유)
- `part_of_body` *(v0.6, 마이그레이션 012)*: 단일 텍스트에서 배열로 변경. 값은 `server_admin`이 정해진 목록(`GET /body-parts`) 안에서만 검증
- `membership_id` *(v0.6, 마이그레이션 011)*: 이 시술기록이 어떤 이용권을 소비했는지 연결. 시술기록을 삭제할 때 그 이용권 차감을 자동으로 되돌리기 위해 추가(`server_admin/patients.service.ts`)

### public.emr_memberships — 계정 연결 전 이용권 *(v0.4 신설 006, v0.6 컬럼 추가 007)*

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
  created_at timestamptz not null default now()
);

create index idx_emr_memberships_patient on public.emr_memberships (patient_id);
```

- `public.memberships`와 동일한 형태로 claim 시 그대로 복사됨(단, `remaining_count`는 GENERATED라 claim 시 복사 대상이 아니라 자동 계산됨)
- `expires_at`은 `public.memberships`와 동일하게 v0.7부터 `server_admin`이 생성 시점(첫 시술일+1년)에 채운다

### public.treatment_catalog — 치료-부위 카탈로그 *(v0.7 신설 013)*

```sql
create table public.treatment_catalog (
  id uuid primary key default gen_random_uuid(),
  care_name text not null unique,
  care_type text not null,
  body_parts text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

- 치료명(`care_name`)을 고르면 기본 `care_type`/관리 부위(`body_parts`) 후보를 자동 제안하기 위한 참조 테이블 — `admin-web` 프로토타입(`docs/WHS_After_Mate_Admin_revised.html`)의 치료 카탈로그 구조를 반영
- 클리닉(브랜드)별로 나누지 않고 **전체 클리닉 공통**으로 관리(brand 컬럼 없음) — 로그인만 되어 있으면 어느 클리닉 관리자든 CRUD 가능
- `care_type`은 등록/수정 시 `reference_guides`에 실제로 존재하는 값인지 서버가 재검증(`GET /care-types`와 동일 로직)
- **참조 관계 없음** — 이미 저장된 시술기록/이용권은 카탈로그를 FK로 참조하지 않고 등록 시점 값을 그대로 복사해 쓴다. 카탈로그 항목을 수정/삭제해도 과거 시술기록엔 영향 없음
- `POST .../care-records`는 이 카탈로그를 강제하지 않는다 — 여전히 `careName`/`careType`/`partOfBody`를 그대로 받는다(카탈로그는 프론트 자동완성 제안용일 뿐)
- `remaining_count` *(v0.6, 마이그레이션 007)*: `public.memberships`와 동일한 패턴의 GENERATED 컬럼. 시술기록 추가 화면에서 "이 이용권 몇 회 남았는지" 토글 목록을 보여줄 때 프론트/서버가 직접 계산하지 않아도 됨

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
| **하루 1회 LLM 생성은 DB 제약으로** | `aftercare_guides`의 UNIQUE로 애플리케이션 로직 실수를 DB가 방어 |
| **전화 인증은 미구현으로 제거** | 국내 SMS 업체 연동 비용이 MVP 범위 밖이라 판단, `phone_verifications` 테이블·`phoneVerifiedToken` 흐름 전부 삭제(`004_remove_phone_verification.sql`) |
| **알러지·의사코멘트는 별도 테이블(`medical_profiles`)로 분리** | `profiles`(앱 계정 데이터)와 성격이 달라 접근 권한·감사 로그를 다르게 관리하기 위함. EMR 동기화 대상이라는 점도 명확히 구분 |
| **의료정보 접근은 감사 로그(`medical_data_access_log`) 필수** | 알러지·의사 코멘트가 민감정보라 "누가/언제/왜" 봤는지 남겨야 함. LLM이 컨텍스트로 읽을 때도 기록 |
| **`relatedRecentCares`/`popularWithSimilarCustomers`/`clinicContacts` 전용 테이블 없음** *(v0.3)* | 추천 상세 화면(`api-spec.md` v0.5)의 확장 필드들이지만 각각 `care_records` 최신 N건 조회, `care_type`별 사전 정의 매핑, `care_records.brand` distinct 조회로 즉석 계산 가능해 저장할 필요가 없음 — 기존 "추천 테이블 없음" 결정과 같은 이유 |
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
