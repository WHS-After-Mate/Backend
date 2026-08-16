# WHS After Mate — Server

Android(Android Studio) 클라이언트가 호출하는 REST API 서버. Node.js + Express + TypeScript, DB/인증은 Supabase, LLM은 Anthropic Claude, 푸시는 Firebase Cloud Messaging(FCM)을 사용한다.

문서 기준: `../docs/api-spec.md` v0.4, `../docs/db-schema.md` v0.2, `../docs/llm-prompt-design.md` v0.1

## 준비

1. Supabase 프로젝트 생성 (https://supabase.com) 후 Settings > API에서 URL/anon key/service role key 확인
2. Anthropic API 키 발급 (https://console.anthropic.com)
3. (선택, 나중에 해도 됨) Firebase 프로젝트 생성 → 서비스 계정 JSON 발급 (FCM 푸시 발송용)

```bash
cp .env.example .env
# .env에 SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY, ANTHROPIC_API_KEY 채우기
npm install
```

## DB 마이그레이션 적용

`db/migrations/*.sql`을 Supabase SQL Editor에 순서대로(001 → 002 → 003 → 004) 붙여넣어 실행한다.
(CLI를 쓴다면 `supabase db push` 또는 `psql`로 동일 파일 실행)

`003_v05_wireframe_features.sql`은 최종 와이어프레임 검토로 추가된 v0.5 항목(비밀번호 재설정 제외, DB 변경 필요분만) 대응 — `profiles`/`care_records` 컬럼 추가 + `membership_usages` 신규 테이블. 001이 먼저 적용돼 `memberships` 테이블이 존재해야 003의 FK가 성립한다.

## 데모 데이터 시드

```bash
npm run seed
```

데모 계정 `demo@whsaftermate.app` / `Passw0rd!2024` 생성 + 관리이력/이용권/의료정보/검수가이드(`reference_guides`) 시드.

## 실행

```bash
npm run dev     # tsx watch, 개발용
npm run build && npm start   # 프로덕션 빌드 실행
npm run typecheck
```

기본 포트 4000, Base URL `http://localhost:4000/api/v1` (Android 에뮬레이터에서는 `http://10.0.2.2:4000/api/v1`).

## 폴더 구조

```
src/
  config/      # env, supabase, anthropic, firebase 클라이언트
  middleware/  # 인증(requireAuth), 에러 핸들러
  lib/         # 에러 정의, 위험신호 키워드, 카테고리
  services/    # 도메인 로직 (DB 접근은 여기서만)
    llm/       # Claude 프롬프트 + 구조화 출력 클라이언트
  validators/  # zod 요청 스키마
  routes/      # Express 라우터 (api-spec.md 절 구성과 1:1)
db/
  migrations/  # SQL DDL (docs/db-schema.md 기준 + 확장분)
  seed/        # 데모 데이터 시드 스크립트
```

## api-spec.md 대비 구현 시 추가/확정한 사항

- **DB**: `care_records.care_type` 컬럼 신규 추가 — `reference_guides.care_type`과 매칭해 LLM 프롬프트에 주입할 검수 가이드를 찾기 위한 내부 키(Android 클라이언트에는 노출 안 함)
- **검수된 관리 가이드(RAG 소스) 저장 위치** (기존 미확정 사항): `public.reference_guides` 테이블로 확정. 이유는 `db/migrations/002_reference_guides_and_device_tokens.sql` 주석 참고
- **위험 신호 키워드**: `src/lib/riskKeywords.ts`에 초안 작성. **전문가(의료진) 검수 전이므로 데모/해커톤 용도로만 사용, 프로덕션 전 반드시 검수 필요**
- **LLM 생성 실패 폴백**: `GET /aftercare/daily-guide`는 LLM 실패 시 503을 던지지 않고 `reference_guides`의 검수 원문을 그대로 사용해 200으로 응답한다(`generatedBy: "reference_guide"`). `POST /aftercare/questions`는 폴백 문구를 만들기 어려워 문서대로 `503 ANSWER_GENERATION_FAILED`를 반환
- **FCM 디바이스 토큰 등록** (Android 특화, api-spec.md에 없던 신규 엔드포인트):
  - `POST /notifications/device-token` — `{ fcmToken, platform: "android" }`, 204
  - `DELETE /notifications/device-token` — `{ fcmToken }`, 204
  - 실제 발송 로직(`src/services/push.service.ts`)은 준비만 해두었고 스케줄러 연동은 MVP 범위 밖
- **전화번호 인증(SMS) — 기능 자체를 제거**: 국내 SMS 중계업체(알리고, NCP SENS 등) 연동은 건당 과금 + 발신번호 사전등록이 필요한 유료 영역이라 MVP 범위 밖으로 확정, `POST /auth/signup/verify-phone/request`·`/confirm` 엔드포인트와 `phoneVerifiedToken` 흐름을 코드에서 완전히 걷어냈다(`db/migrations/004_remove_phone_verification.sql`로 `phone_verifications` 테이블/`profiles.phone_verified_at` 컬럼도 제거). 회원가입은 이제 `phone`을 그냥 연락처 값으로만 받는다. 향후 실 연동이 필요해지면 별도 논의 후 재설계.
- **회원가입 `birthDate` 필드 추가**: `POST /auth/signup`에 생년월일(`YYYY-MM-DD`)이 필수 필드로 추가됐고, 가입 시 입력값이 `profiles.birth_date`에 바로 저장돼 `GET /profile`의 `birthDate`로 조회된다(이전에는 회원가입엔 없고 `PATCH /profile`로만 채울 수 있었음).
- **비밀번호 찾기(`POST /auth/password/reset-request`)**: SMS와 달리 개발용 우회 모드가 없다. Supabase Auth `resetPasswordForEmail`에 그대로 위임하기 때문에 호출 즉시 실제로 메일이 발송된다. 따라서 이 플로우를 끝까지 테스트하려면 회원가입 시 실제로 수신 가능한 이메일 주소로 가입해둔 계정이 필요하다(회원가입 자체는 `admin.createUser({ email_confirm: true })`라 가짜 이메일도 통과됨).
- **비밀번호 재설정을 이메일 링크에서 숫자 인증코드로 전환**: `POST /auth/password/reset-confirm`의 요청이 `{recoveryToken, newPassword}`에서 `{email, code, newPassword}`로 바뀌었다 — `code`는 Supabase의 `auth.verifyOtp({ email, token: code, type: "recovery" })`로 검증한다. **Supabase 대시보드에서 수동 설정 필요**: Authentication → Email Templates → Reset Password 템플릿에 `{{ .Token }}`이 포함돼 있어야 실제 이메일에 코드가 보인다(기본 템플릿은 링크만 보여줌 — 코드로는 바꿀 수 없는 대시보드 전용 설정, 커스텀 SMTP 연동 필수). 이미 코드 전용 플로우로 전환했으므로 템플릿에서 `{{ .ConfirmationURL }}` 링크 자체도 제거해뒀다. OTP 자리수는 흔히 "6자리"로 알려져 있지만 고정 스펙이 아니라 프로젝트 설정에 따라 다르다 — 이 프로젝트는 실측으로 **8자리**임을 확인했다(`code` 검증은 6~10자리를 느슨하게 허용). 커스텀 SMTP(Gmail) 연동 완료 후 실제 이메일 발송→코드 검증→새 비밀번호 로그인까지 라이브로 실측 검증 완료.
- **회원가입에 관심 목표(`interestGoals`) 추가**: `POST /auth/signup`이 회원가입 화면에서 중복 선택한 관심 목표를 받아 그 자리에서 `profiles.interest_goals`에 저장한다(생략하면 빈 배열). 이전에는 가입 후 `PUT /profile/interests`에서만 설정 가능했다.
- **추천 상세조회 라우팅**: `recommendationId`는 저장되지 않고 `userId` 기반 결정론적 해시로 매 요청 생성 — `GET /recommendations/next-care/{id}`는 재계산 후 id가 일치할 때만 상세를 반환
- **알림 설정(`GET`/`PATCH /notifications/settings`) — 기능 자체를 제거**: `pushEnabled`/`aftercareReminder`/`membershipExpiryAlert`/`marketingAlert` 4개 값 모두 DB에 저장만 될 뿐, 실제로 읽어서 발송 여부를 분기하는 코드가 없는 placeholder였다(발송 스케줄러 자체가 미구현). 엔드포인트와 `profiles`의 관련 4개 컬럼을 함께 삭제했다(`db/migrations/005_remove_notification_settings.sql`). FCM 디바이스 토큰 등록/해제(`POST`/`DELETE /notifications/device-token`)는 실제로 쓰이므로 그대로 유지
- **v0.5 신규 항목** (최종 와이어프레임 검토 반영, `docs/api-spec.md` v0.5): 비밀번호 재설정/변경(`POST /auth/password/reset-request`·`/reset-confirm`, `POST /profile/password`), 프로필 `birthDate`/`phone`, 알림 `marketingAlert`, 이용권 `usageHistory`, 관리 상세 `status`/`daysElapsed`/`session`/`membership`, `GET /aftercare/daily-guide?elapsedDay=`, 추천 상세 `relatedRecentCares`/`popularWithSimilarCustomers`/`clinicContacts` — 전부 구현 완료. DB 컬럼/테이블이 필요한 항목은 `db/migrations/003_v05_wireframe_features.sql`로 이미 적용 완료됐다 (자세한 구현 위치는 `docs/server-code-guide.md` 9절 참고)

## TODO — 프로덕션 전 처리 필요

- ~~Supabase 커스텀 SMTP 연동~~ — **완료**. 처음엔 Resend로 연동했으나, 발신 주소가 테스트 도메인(`onboarding@resend.dev`)이라 **Resend 계정 소유자 본인 이메일로만 발송 가능**한 제약이 있었고 이를 풀려면 커스텀 도메인 구매·인증이 필요했다. 도메인 구매 없이 실사용자 전체에게 발송 가능하도록, **발송 전용 Gmail 계정(`ykenko02@gmail.com`)의 SMTP로 재연동**했다(Supabase 대시보드 → Authentication → Emails → SMTP Settings, Host `smtp.gmail.com`/Port 587/Username은 해당 Gmail 주소, 비밀번호는 2단계 인증 활성화 후 발급한 앱 비밀번호). 개인 메인 계정이 아닌 전용 계정을 써서 계정 잠금 리스크를 격리했다. Reset Password 템플릿에서도 `{{ .Token }}` 인증코드만 남기고 `{{ .ConfirmationURL }}` 링크는 제거(코드 전용 플로우라 불필요). 계정 소유자가 아닌 임의의 실제 Gmail 주소로 발송→수신까지 라이브 검증 완료. 다만 Gmail SMTP는 트랜잭션 메일 전용 서비스가 아니라서(Supabase 대시보드도 "개인용 이메일 발송에 최적화된 프로바이더" 경고를 띄움) 발송량이 몰리면 스팸/전송 제한 리스크가 있다 — 정식 서비스 규모로 전환할 때는 도메인 인증 기반 트랜잭션 메일 서비스(Resend 등)로 재검토 필요.
