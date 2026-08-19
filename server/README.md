# WHS After Mate — Server

Android(Android Studio) 클라이언트가 호출하는 REST API 서버. Node.js + Express + TypeScript, DB/인증은 Supabase, LLM은 OpenAI, 푸시는 Firebase Cloud Messaging(FCM)을 사용한다.

문서 기준: `../docs/api-spec.md` v0.17, `../docs/db-schema.md` v0.11, `../docs/llm-prompt-design.md` v0.5

## 준비

1. Supabase 프로젝트 생성 (https://supabase.com) 후 Settings > API에서 URL/anon key/service role key 확인
2. OpenAI API 키 발급 (https://platform.openai.com)
3. (선택, 나중에 해도 됨) Firebase 프로젝트 생성 → 서비스 계정 JSON 발급 (FCM 푸시 발송용)

```bash
cp .env.example .env
# .env에 SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY, OPENAI_API_KEY 채우기
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

데모 계정 `demo@whsaftermate.app` / `Passw0rd!2024` 생성 + 관리이력/이용권/의료정보 시드. `(v0.11 갱신 시점 기준)` 사후관리 콘텐츠는 이 스크립트가 아니라 아래 `npm run seed:treatment-guides`로 별도 시딩한다.

```bash
npm run seed:treatment-guides   # treatment_guides(시술명+경과일 콘텐츠) 시드 — db/seed/seedTreatmentGuides.ts
```

~~이 스크립트는 깨져 있었다~~ — **수정 완료.** 삭제된 `care_type` 컬럼/`reference_guides` 테이블을 여전히 insert하려던 코드(`care_type` 필드, `REFERENCE_GUIDES` 배열+시딩 블록)를 전부 제거했다. 실제로 `npm run seed`를 돌려 데모 계정 4개가 에러 없이 재시딩되는 것까지 확인됨.

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
  config/      # env, supabase, openai, firebase 클라이언트
  middleware/  # 인증(requireAuth), 에러 핸들러
  lib/         # 에러 정의, 위험신호 키워드, 카테고리
  services/    # 도메인 로직 (DB 접근은 여기서만)
    llm/       # OpenAI 프롬프트 + 구조화 출력 클라이언트
  validators/  # zod 요청 스키마
  routes/      # Express 라우터 (api-spec.md 절 구성과 1:1)
db/
  migrations/  # SQL DDL (docs/db-schema.md 기준 + 확장분)
  seed/        # 데모 데이터 시드 스크립트
```

## api-spec.md 대비 구현 시 추가/확정한 사항

- **DB**: ~~`care_records.care_type` 컬럼~~ — `reference_guides.care_type`과 매칭해 LLM 프롬프트에 주입할 검수 가이드를 찾기 위한 내부 키였으나, **v0.10(`024`)에서 컬럼째 삭제됐다.** daily-guide/questions는 이제 `care_name`+경과일로 `treatment_guides`를 직접 매칭한다(아래 참고)
- **사후관리 콘텐츠(RAG 소스) 저장 위치**: `(v0.10)` `public.treatment_guides` 테이블로 확정 — 시술명(`care_name`)+경과일(`day`, 1/3/5/7/14) 단위, 팀이 직접 작성한 콘텐츠. *(v0.9까지는 `public.reference_guides`, `care_type` 그룹 단위였다 — 그 테이블은 삭제됐다.)*
- **위험 신호 키워드**: `src/lib/riskKeywords.ts`에 초안 작성. **전문가(의료진) 검수 전이므로 데모/해커톤 용도로만 사용, 프로덕션 전 반드시 검수 필요**
- **daily-guide는 LLM을 호출하지 않는다** `(v0.10)`: `GET /aftercare/daily-guide`는 `treatment_guides`를 시술명+경과일로 직접 조회해 그대로 반환한다 — LLM 호출도, "생성 실패 시 폴백"도 없다(매칭 없으면 바로 `404 GUIDE_NOT_AVAILABLE`). *(v0.9까지는 LLM 실패 시 503 대신 `reference_guides` 원문으로 폴백했었다.)* `POST /aftercare/questions`는 여전히 LLM을 호출하고, 실패하면 `503 ANSWER_GENERATION_FAILED`를 반환
- **FCM 디바이스 토큰 등록** (Android 특화, api-spec.md에 없던 신규 엔드포인트):
  - `POST /notifications/device-token` — `{ fcmToken, platform: "android" }`, 204
  - `DELETE /notifications/device-token` — `{ fcmToken }`, 204
  - `(v0.10)` 실제 발송 스케줄러도 구현 완료 — `src/services/notificationScheduler.service.ts`가 매일 09:00/19:00 KST 크론으로 발송(`FCM_ENABLED=true`일 때만 기동), `GET/PATCH /profile/notifications`로 사용자가 켜고 끌 수 있음
- **전화번호 인증(SMS) — 기능 자체를 제거**: 국내 SMS 중계업체(알리고, NCP SENS 등) 연동은 건당 과금 + 발신번호 사전등록이 필요한 유료 영역이라 MVP 범위 밖으로 확정, `POST /auth/signup/verify-phone/request`·`/confirm` 엔드포인트와 `phoneVerifiedToken` 흐름을 코드에서 완전히 걷어냈다(`db/migrations/004_remove_phone_verification.sql`로 `phone_verifications` 테이블/`profiles.phone_verified_at` 컬럼도 제거). 회원가입은 이제 `phone`을 그냥 연락처 값으로만 받는다. 향후 실 연동이 필요해지면 별도 논의 후 재설계.
- **회원가입 `birthDate` 필드 추가**: `POST /auth/signup`에 생년월일(`YYYY-MM-DD`)이 필수 필드로 추가됐고, 가입 시 입력값이 `profiles.birth_date`에 바로 저장돼 `GET /profile`의 `birthDate`로 조회된다(이전에는 회원가입엔 없고 `PATCH /profile`로만 채울 수 있었음).
- **비밀번호 찾기(`POST /auth/password/reset-request`)**: SMS와 달리 개발용 우회 모드가 없다. Supabase Auth `resetPasswordForEmail`에 그대로 위임하기 때문에 호출 즉시 실제로 메일이 발송된다. 따라서 이 플로우를 끝까지 테스트하려면 회원가입 시 실제로 수신 가능한 이메일 주소로 가입해둔 계정이 필요하다(회원가입 자체는 `admin.createUser({ email_confirm: true })`라 가짜 이메일도 통과됨).
- **비밀번호 재설정을 이메일 링크에서 숫자 인증코드로 전환**: `POST /auth/password/reset-confirm`의 요청이 `{recoveryToken, newPassword}`에서 `{email, code, newPassword}`로 바뀌었다 — `code`는 Supabase의 `auth.verifyOtp({ email, token: code, type: "recovery" })`로 검증한다. **Supabase 대시보드에서 수동 설정 필요**: Authentication → Email Templates → Reset Password 템플릿에 `{{ .Token }}`이 포함돼 있어야 실제 이메일에 코드가 보인다(기본 템플릿은 링크만 보여줌 — 코드로는 바꿀 수 없는 대시보드 전용 설정, 커스텀 SMTP 연동 필수). 이미 코드 전용 플로우로 전환했으므로 템플릿에서 `{{ .ConfirmationURL }}` 링크 자체도 제거해뒀다. OTP 자리수는 흔히 "6자리"로 알려져 있지만 고정 스펙이 아니라 프로젝트 설정에 따라 다르다 — 이 프로젝트는 실측으로 **8자리**임을 확인했다. 커스텀 SMTP(Gmail) 연동 완료 후 실제 이메일 발송→코드 검증→새 비밀번호 로그인까지 라이브로 실측 검증 완료.
- **비밀번호 재설정을 코드 검증 단계와 비밀번호 변경 단계로 재분리**: 와이어프레임(`docs/After_Mate.png` 05번)이 "인증번호 발송" → "인증번호 확인" → "새 비밀번호 저장"을 별도 버튼 3개로 그리고 있어, 위에서 합쳐뒀던 코드 검증과 비밀번호 변경을 다시 나눴다. 신규 `POST /auth/password/reset-verify({email, code})`가 `verifyOtp`로 코드만 검증해 `{ resetToken }`을 내려주고(코드는 이 호출로 소진되어 재사용 불가 — 실측 확인), `POST /auth/password/reset-confirm`은 이제 `{resetToken, newPassword}`만 받아 `auth.getUser(resetToken)`으로 재확인 후 비밀번호를 갱신한다(`email`/`code`를 더 이상 직접 받지 않음). `code` 검증은 여전히 6~10자리를 느슨하게 허용한다. 발송→확인→변경→새 비밀번호 로그인까지 3단계 전체를 라이브로 실측 검증 완료.
- **회원가입에 관심 목표(`interestGoals`) 추가**: `POST /auth/signup`이 회원가입 화면에서 중복 선택한 관심 목표를 받아 그 자리에서 `profiles.interest_goals`에 저장한다(생략하면 빈 배열). 이전에는 가입 후 `PUT /profile/interests`에서만 설정 가능했다.
- **추천 상세조회 라우팅**: `recommendationId`는 저장되지 않고 `userId` 기반 결정론적 해시로 매 요청 생성 — `GET /recommendations/next-care/{id}`는 재계산 후 id가 일치할 때만 상세를 반환
- **알림 설정(`GET`/`PATCH /notifications/settings`) — 기능 자체를 제거(v0.5 시점)**: `pushEnabled`/`aftercareReminder`/`membershipExpiryAlert`/`marketingAlert` 4개 값 모두 DB에 저장만 될 뿐, 실제로 읽어서 발송 여부를 분기하는 코드가 없는 placeholder였다(발송 스케줄러 자체가 미구현). 엔드포인트와 `profiles`의 관련 4개 컬럼을 함께 삭제했다(`db/migrations/005_remove_notification_settings.sql`). FCM 디바이스 토큰 등록/해제(`POST`/`DELETE /notifications/device-token`)는 실제로 쓰이므로 그대로 유지
- **알림 설정 재도입(`GET`/`PATCH /profile/notifications`) `(v0.10)`**: 이번엔 placeholder가 아니다 — `care_notification`/`marketing_notification` 2개 컬럼(`db/migrations/019_add_notification_settings.sql`)을 `push.service.ts`의 `sendPushToUser`가 실제로 읽어 발송 여부를 분기한다. `notificationScheduler.service.ts`(크론)와 `notification_log`(`020`, 중복 발송 방지)도 함께 추가됐다
- **`care_type` 개념 완전 제거 (v0.10)**: daily-guide/questions의 근거가 `care_type` 그룹 단위(`reference_guides`)에서 시술명 직접 매칭(`treatment_guides`)으로 바뀌며, `care_records`/`treatment_catalog`의 `care_type` 컬럼과 `reference_guides`/`aftercare_guides` 테이블이 전부 삭제됐다(`db/migrations/019`~`025`). 자세한 내용은 `docs/db-schema.md`/`docs/llm-prompt-design.md` v0.10/v0.5 참고
- **`treatment_catalog`에 `brand` 컬럼 추가 (v0.10, `server_admin`)**: 클리닉 공통이던 치료-부위 카탈로그가 클리닉별로 분리됐다 — 자세한 내용은 `server_admin/README.md` 참고
- **v0.5 신규 항목** (최종 와이어프레임 검토 반영, `docs/api-spec.md` v0.5): 비밀번호 재설정/변경(`POST /auth/password/reset-request`·`/reset-confirm`, `POST /profile/password`), 프로필 `birthDate`/`phone`, 알림 `marketingAlert`, 이용권 `usageHistory`, 관리 상세 `status`/`daysElapsed`/`session`/`membership`, `GET /aftercare/daily-guide?elapsedDay=`, 추천 상세 `relatedRecentCares`/`popularWithSimilarCustomers`(v0.15에서 제거, 아래 참고)/`clinicContacts` — 전부 구현 완료. DB 컬럼/테이블이 필요한 항목은 `db/migrations/003_v05_wireframe_features.sql`로 이미 적용 완료됐다 (자세한 구현 위치는 `docs/server-code-guide.md` 9절 참고)
- **추천 상세 `popularWithSimilarCustomers` → `categoryTags`로 교체(v0.15)**: 아무도 쓰지 않아 제거하고, 대신 추천된 시술이 `care_procedure_template.xlsx`에서 O로 표시된 관심목표 칼럼(`procedures.category_tags`)을 그대로 노출한다. `server/src/services/recommendations.service.ts`
- **"최근 관리 이력" 조회가 미래 예약을 제외하도록 수정(v0.17, 버그 수정)**: `careRecords.service.ts`의 `getLatestCareRecord`/`listRecentCareRecords`가 `care_date <= 오늘(KST)` 조건 없이 그냥 최신순 정렬만 하고 있어서, `server_admin`의 예약(미래 날짜) 등록 기능과 맞물려 daily-guide/챗봇/홈요약/추천이 전부 아직 안 받은 미래 예약을 "가장 최근 관리"로 오인하는 버그가 실사용 중 발견됐다. `daysElapsedSince`가 미래 날짜를 0으로 클램프하다 보니 챗봇이 "오늘이 시술 당일"처럼 잘못 답하는 형태로 나타났다. `docs/api-spec.md` v0.17 참고
- **FCM 발송 실패를 로그로 남기도록 수정(v0.17)**: `push.service.ts`(`server`/`server_admin` 둘 다)가 `sendEachForMulticast`의 결과를 확인 안 하고 있어서, 토큰이 전부 실패해도(예: 앱이 백엔드와 다른 Firebase 프로젝트를 쓰는 `SenderId mismatch`) 아무 에러도 안 남기고 조용히 묻혔다. 이제 실패한 토큰마다 `userId`+에러코드/메시지를 `console.error`로 남긴다. 실사용 중 실제로 이 방식으로 오세훈 계정의 기기 토큰이 다른 Firebase 프로젝트(`ms-project-da87f`가 아닌 곳)에서 발급된 걸 발견함 — 앱이 백엔드와 같은 Firebase 프로젝트의 `google-services.json`을 쓰는지 프론트 쪽 확인 필요

## TODO — 프로덕션 전 처리 필요

- ~~`reference_guides`의 새 care_type 5종이 미검수 문구인 문제~~ — **v0.10에서 구조적으로 해소됨.** `reference_guides` 테이블 자체가 삭제되고 `treatment_guides`(시술명 단위, 팀이 처음부터 직접 작성)로 대체되며 "검수 워크플로가 있는데 코드가 검사 안 함"이라는 문제의 전제가 사라졌다. 다만 `treatment_guides`의 콘텐츠 품질 자체(의료 정확성)는 여전히 팀 작성 초안 수준이라 프로덕션 전 의료진 검수는 별개로 필요
- ~~`npm run seed`(`db/seed/seed.ts`)가 깨져 있음~~ — **v0.11에서 수정됨**(위 "데모 데이터 시드" 절 참고)
- ~~Supabase 커스텀 SMTP 연동~~ — **완료**. 처음엔 Resend로 연동했으나, 발신 주소가 테스트 도메인(`onboarding@resend.dev`)이라 **Resend 계정 소유자 본인 이메일로만 발송 가능**한 제약이 있었고 이를 풀려면 커스텀 도메인 구매·인증이 필요했다. 도메인 구매 없이 실사용자 전체에게 발송 가능하도록, **발송 전용 Gmail 계정(`ykenko02@gmail.com`)의 SMTP로 재연동**했다(Supabase 대시보드 → Authentication → Emails → SMTP Settings, Host `smtp.gmail.com`/Port 587/Username은 해당 Gmail 주소, 비밀번호는 2단계 인증 활성화 후 발급한 앱 비밀번호). 개인 메인 계정이 아닌 전용 계정을 써서 계정 잠금 리스크를 격리했다. Reset Password 템플릿에서도 `{{ .Token }}` 인증코드만 남기고 `{{ .ConfirmationURL }}` 링크는 제거(코드 전용 플로우라 불필요). 계정 소유자가 아닌 임의의 실제 Gmail 주소로 발송→수신까지 라이브 검증 완료. 다만 Gmail SMTP는 트랜잭션 메일 전용 서비스가 아니라서(Supabase 대시보드도 "개인용 이메일 발송에 최적화된 프로바이더" 경고를 띄움) 발송량이 몰리면 스팸/전송 제한 리스크가 있다 — 정식 서비스 규모로 전환할 때는 도메인 인증 기반 트랜잭션 메일 서비스(Resend 등)로 재검토 필요.
