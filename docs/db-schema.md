# WHS After Mate — DB 스키마 (v0.2)

기준: `api-spec.md` v0.4. **PostgreSQL (Supabase)** 사용 — 계정·비밀번호·토큰은 Supabase Auth(`auth.users`)에 위임하고, 앱 데이터는 `public` 스키마에 직접 구성한다. 전화번호 SMS 인증은 Supabase의 phone-auth 기능을 쓰지 않고 `phone_verifications` 테이블로 직접 구현한다(국내 SMS 업체 연동 때문).

시각 자료(ERD, 확대/드래그 가능한 다이어그램)는 `db-schema.html` 참고.

---

## 인증 (Supabase 관리, 직접 구현 안 함)

이메일/비밀번호 계정 생성, 비밀번호 해싱, access/refresh 토큰 발급·재발급·폐기는 Supabase Auth가 처리한다. 우리 테이블은 `auth.users.id`를 FK로 참조만 한다.

**가입 흐름**: `POST /auth/signup/verify-phone/request` → 서버가 국내 SMS API 호출 → `phone_verifications`에 코드 해시 저장 → `/confirm`으로 검증 → `phoneVerifiedToken` 발급 → `POST /auth/signup` 호출 시 토큰 검증 후 `supabase.auth.signUp()` → 생성된 `user.id`로 `profiles` 행 insert.

---

## 클리닉 의료 데이터 연동 — 구조적 전제

이 서비스는 **클리닉(AAC)의 의료 데이터베이스(EMR)에 이미 존재하는 환자 기록**을 바탕으로 환자 본인에게 사후관리를 제공한다 (환자가 자기 진료기록을 열람하는 patient-portal과 같은 구조). 즉 `care_records`의 시술 이력, 알러지 정보, 의사 코멘트는 **우리 앱이 원본 데이터를 만드는 게 아니라 클리닉 EMR에서 동기화(sync)해온 사본**이다.

- **원본(source of truth)**: 클리닉 EMR (별도 시스템, 이 저장소 범위 밖)
- **우리 DB의 역할**: EMR에서 필요한 필드만 읽기 전용으로 동기화해 patient-facing 앱과 LLM 컨텍스트에 사용
- **MVP 범위**: 실제 EMR 연동 대신 가상 데이터를 우리 테이블에 직접 시드(seed)한다. 다만 스키마는 나중에 실제 배치 동기화(ETL)로 교체 가능하도록 `external_*_id` / `synced_at` / `source_system` 필드를 처음부터 넣어둔다.
- **왜 알러지·의사코멘트가 중요한가**: `POST /aftercare/questions`(LLM 답변)와 `GET /aftercare/daily-guide`(일차별 가이드) 생성 시, 알러지·의사 코멘트를 컨텍스트에 포함시켜야 "환자가 알러지 있는 성분을 권하는" 것 같은 실수를 막을 수 있다.
- **민감정보 취급**: 알러지·의사 코멘트는 개인정보보호법상 건강에 관한 민감정보에 해당한다. 접근 로그(`medical_data_access_log`)를 별도로 남긴다.

---

## 테이블 정의

### public.profiles — 1:1 auth.users

```sql
create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  phone text unique,
  phone_verified_at timestamptz,
  interest_goals text[] not null default '{}',
  push_enabled boolean not null default true,
  aftercare_reminder boolean not null default true,
  membership_expiry_alert boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

| 컬럼 | 설명 |
|---|---|
| `user_id` | PK, `auth.users(id)` 참조, 계정 삭제 시 CASCADE |
| `interest_goals` | 관심 목표 — 추천 API(`basis: goal`)의 입력값 |
| `push_enabled` / `aftercare_reminder` / `membership_expiry_alert` | 알림 설정. 1:1이라 별도 테이블로 안 쪼갬 |

→ `GET/PATCH /profile`, `PUT /profile/interests`, `GET/PATCH /notifications/settings` 모두 이 한 테이블로 처리.

### public.phone_verifications — 독립 테이블 (가입 전 단계, 계정과 미연결)

```sql
create table public.phone_verifications (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts int not null default 0,
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_phone_verifications_phone_created
  on public.phone_verifications (phone, created_at desc);
```

- `code_hash`: OTP 코드는 평문 저장 금지, 해시만 저장
- `attempts`: 오입력 횟수 — 초과 시 `429 TOO_MANY_ATTEMPTS`
- 인덱스: 같은 번호로 재요청 주기 제한(`429 TOO_MANY_REQUESTS`) 체크용

### public.care_records — 클리닉 EMR에서 동기화된 시술 이력

```sql
create table public.care_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  care_name text not null,
  care_type text,
  care_date date not null,
  part_of_body text,
  brand text,
  store text,
  practitioner text,
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

---

## 설계 결정 (테이블을 일부러 안 만든 것들)

| 결정 | 이유 |
|---|---|
| **추천(Recommendation) 테이블 없음** | 규칙 기반이라 매 요청 시 `care_records`+`memberships`+`profiles.interest_goals`로 즉석 계산. `recommendationId`는 응답 시점에 생성해 상세조회 라우팅에만 사용 |
| **refresh token 테이블 없음** | Supabase Auth가 내부 관리. `POST /auth/refresh`·`/logout`은 Supabase SDK 호출로 대체 |
| **알림 설정은 profiles 컬럼** | 사용자당 1행이라 별도 테이블 정규화 이득 없음. 항목이 늘어나면 그때 분리 |
| **캘린더는 집계 쿼리** | `care_records`를 월 단위로 `GROUP BY`. 별도 마커 테이블 유지 비용 없음 |
| **하루 1회 LLM 생성은 DB 제약으로** | `aftercare_guides`의 UNIQUE로 애플리케이션 로직 실수를 DB가 방어 |
| **전화 인증은 Supabase 기능 미사용** | 국내 SMS 업체 연동을 위해 `phone_verifications` 직접 구현 |
| **알러지·의사코멘트는 별도 테이블(`medical_profiles`)로 분리** | `profiles`(앱 계정 데이터)와 성격이 달라 접근 권한·감사 로그를 다르게 관리하기 위함. EMR 동기화 대상이라는 점도 명확히 구분 |
| **의료정보 접근은 감사 로그(`medical_data_access_log`) 필수** | 알러지·의사 코멘트가 민감정보라 "누가/언제/왜" 봤는지 남겨야 함. LLM이 컨텍스트로 읽을 때도 기록 |

## 알려진 트레이드오프

- 스키마가 고정적 — 컬럼 추가/변경 시 마이그레이션 필요 (Prisma 등으로 빠르게 처리 가능)
- Supabase 무료 플랜은 장기간 미접속 시 프로젝트가 자동 일시정지(pause)됨 — 데모 전날 접속 확인 필요
- 클라이언트가 DB에 직접 붙는 패턴을 쓸 경우 Row Level Security(RLS) 미설정 시 다른 사용자 데이터 노출 위험. 지금 구조(백엔드 서버가 인증된 `user_id`로 필터링)에서는 해당 위험이 낮음
- 실제 서비스로 갈 경우 클리닉 EMR과의 연동은 별도 법적 검토(개인정보 제3자 제공/위탁 동의, 의료법 관련 규정)가 필요함 — MVP는 가상 데이터 시드로 이 부분을 우회하지만, 프로덕션 전환 시 반드시 확인해야 할 항목
