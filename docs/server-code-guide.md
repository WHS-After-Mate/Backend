# WHS After Mate — 서버 코드 설명서 (v0.1)

`api-spec.md`가 "각 엔드포인트를 호출하면 무엇을 주고받는가"를 정의한 계약서라면,
이 문서는 **그 계약을 `server/src` 코드가 실제로 어떻게 구현하는가**를 설명한다.
파일 경로·함수명 기준으로 작성했으므로 코드와 나란히 두고 보는 것을 전제로 한다.

대상 커밋: `16c2f5f` (2026-08-02, 백엔드 1차 구현 + Supabase/Anthropic 연동 + 엔드투엔드 테스트 완료 시점) + v0.5 신규 항목 9건(2026-08-05, 아직 별도 커밋 전 — 9절 "v0.5 신규 항목" 참고)

---

## 1. 레이어 구조와 책임

```
src/
  server.ts      → app.listen (프로세스 진입점)
  app.ts         → express 인스턴스 조립 (미들웨어 순서 결정)
  routes/        → URL·HTTP 메서드 ↔ 서비스 함수 연결, req/res만 다룸 (비즈니스 로직 없음)
  validators/    → zod 스키마 — 요청 바디/쿼리 검증 (routes에서만 호출)
  services/      → 도메인 로직 + DB(Supabase) 접근. **DB 접근은 반드시 이 레이어를 통해서만 한다**
    services/llm/ → Claude 프롬프트 정의 + 구조화 출력 호출 클라이언트
  middleware/    → 인증(requireAuth), 공통 에러 핸들러
  lib/           → 상태 없는 순수 유틸(에러 정의, 위험신호 키워드, sanitize 등)
  config/        → 외부 서비스 클라이언트 초기화(Supabase, Anthropic, Firebase) + 환경변수 스키마
```

핵심 규칙: **routes는 얇게, services는 두껍게.** 라우트 핸들러는 "요청 파싱 → 서비스 호출 →
상태 코드로 응답"만 하고, 실제 판단(캐시 확인, LLM 호출, 정책 검증, DB 쿼리)은 전부
`services/*.ts`에 있다. 코드에서 특정 동작을 찾을 때는 라우트가 아니라 서비스 파일을 봐야 한다.

---

## 2. 요청 처리 파이프라인

모든 요청은 `app.ts` → `routes/index.ts` → 개별 라우터 순으로 흐른다.

```
app.ts
 ├─ cors, express.json()
 ├─ GET /health                         (인증 불필요, 헬스체크)
 ├─ /api/v1  → routes/index.ts (apiRouter)
 │    ├─ /auth/*                        ← requireAuth 이전에 마운트 (로그인 전이라 토큰이 없음)
 │    ├─ requireAuth 미들웨어           ← 이 지점부터 모든 라우트가 인증 필요
 │    ├─ /home, /recommendations, /aftercare,
 │    │  /care-records, /memberships, /profile, /notifications
 ├─ notFoundHandler                     (매칭 라우트 없을 때 404)
 └─ errorHandler                        (모든 예외의 최종 처리 지점)
```

- **`middleware/auth.ts`**: `Authorization: Bearer {accessToken}`을 꺼내
  `supabaseAnon.auth.getUser(token)`으로 검증한다. 서버가 JWT 시크릿을 직접 들고 있지 않고
  Supabase Auth API에 위임하므로, 토큰 발급/회전 로직은 전부 Supabase에 맡긴다. 검증 성공 시
  `req.userId`에 Supabase user id를 심어 이후 모든 서비스 함수가 이 값으로 `user_id` 필터링을 한다.
- **`lib/asyncHandler.ts`**: Express 4는 async 핸들러 안에서 던진 예외(reject)를 자동으로
  `next()`에 넘기지 않는다. 모든 라우트 핸들러를 `asyncHandler(...)`로 감싸 예외를
  `errorHandler`까지 전달되게 만든다 — 라우트 코드에 매번 try/catch를 쓰지 않기 위한 장치.
- **`middleware/errorHandler.ts`** + **`lib/errors.ts`**: 서비스 레이어는 `throw Errors.xxx()`
  형태로만 실패를 표현한다. `ApiError`는 `api-spec.md`의 "공통 에러 코드" 표와 1:1 대응하는
  `{status, code, message}`를 갖고 있어, 이 클래스의 인스턴스인지만 확인하면 응답 포맷이 정해진다.
  `ZodError`(검증 실패)는 별도로 잡아 400 `VALIDATION_ERROR`로 변환한다.

---

## 3. 인증 / 온보딩 (`routes/auth.routes.ts` → `services/auth.service.ts`)

전화번호 SMS 인증은 국내 업체 연동 비용 때문에 MVP 범위 밖으로 확정되어 코드에서 완전히 제거됐다
(`server/db/migrations/004_remove_phone_verification.sql`) — `lib/otp.ts`/`lib/sms.ts`/`lib/signedToken.ts`도
함께 삭제됐다. 아래는 현재(전화인증 제거 후) 흐름이다.

1. `POST /signup` → `signup`
   - 동일 전화번호로 이미 가입된 프로필이 있으면 `PHONE_ALREADY_EXISTS`로 차단 →
     `supabaseAdmin.auth.admin.createUser`로 계정 생성 → `profiles` 테이블에 이름/전화번호/생년월일
     (`birthDate` → `birth_date`) insert → 프로필 insert가 실패하면 방금 만든 Auth 유저를 롤백
     (`deleteUser`)해 고아 계정을 남기지 않는다 → 마지막으로 내부적으로 `login()`을 호출해 응답 스키마를
     로그인과 동일하게 맞춘다.
2. `POST /login` / `POST /refresh` / `POST /logout`
   - 이 세 개는 자체 로직 없이 **Supabase Auth를 그대로 감싸는 얇은 래퍼**다:
     `supabaseAnon.auth.signInWithPassword` / `refreshSession` / `supabaseAdmin.auth.admin.signOut(..., "global")`.
     accessToken/refreshToken의 실제 발급·검증·만료 정책은 Supabase 쪽 설정을 따른다
     (→ "미확정 사항": refreshToken 만료 정책은 Supabase 기본값 그대로 사용 중).

---

## 4. 홈 / 추천 (`services/home.service.ts`, `services/recommendations.service.ts`)

- **`getHomeSummary`**: 홈 진입 1회 호출을 위해 4가지를 병렬로 모은다 — 최근 관리
  (`careRecords.service.getLatestCareRecord`), 오늘자 캐시된 사후관리 가이드
  (`aftercare_guides`를 직접 조회, LLM을 다시 호출하지 않음), 이용권 요약
  (`memberships.service.countMemberships` + `getNearestExpiringMembership`), 다음 관리 추천
  (`recommendations.service.computeNextCareRecommendation`). LLM 호출은 여기서 발생하지 않는다 —
  `daily-guide`가 이미 생성해 둔 캐시를 재사용하거나, 없으면 `aftercareCard: null`을 반환한다.
- **`computeNextCareRecommendation`**: 이름과 달리 **규칙 기반, LLM 미사용**. 최근 관리 후
  경과일이 `MIN_INTERVAL_DAYS(21일)` 이상인지, 보유 이용권 중 잔여 횟수가 있는 관리명인지,
  관심 목표(`profiles.interest_goals`)와 이름이 매칭되는지를 순서대로 확인해 `reasons`/`basis`
  배열을 채운다. 추천 대상이 없으면 `null` → 라우트에서 `204`로 변환.
  `recommendationId`는 DB에 저장하지 않고 `sha1("recommendation:" + userId)`로 매번 같은 값을
  만드는 **결정론적 해시**다(`recommendationIdFor`) — 그래서 상세 조회(`getNextCareRecommendationDetail`)는
  추천을 다시 계산한 뒤 id가 일치하는지만 확인하는 방식으로 동작한다.

---

## 5. 사후관리 안내 및 Q&A — LLM 파이프라인 (`services/aftercare.service.ts`)

가장 복잡한 레이어. `docs/llm-prompt-design.md`에서 정의한 원칙(구조화 출력 강제, 검수 가이드를
근거로만 사용, 의료적 진단 금지)을 실제로 구현한 코드다. 두 호출 지점의 흐름을 나눠서 본다.

### 5-1. `GET /aftercare/daily-guide` → `getOrGenerateDailyGuide`

```
1. careRecordId 지정 없으면 최근 관리 이력 사용 (getLatestCareRecord)
2. 오늘(KST) 이미 생성된 캐시가 있으면 그대로 반환 — LLM 재호출 없음 (getCachedGuide)
3. daysElapsedSince()로 경과일 계산 (KST 자정 기준 날짜 차이)
4. findReferenceGuide(care_type, daysElapsed)로 "검수된 가이드" 구간을 lookup
   → 못 찾으면 404 GUIDE_NOT_AVAILABLE (LLM을 아예 호출하지 않음)
5. getMedicalProfileForLlmContext()로 알러지/기저질환 조회 + medical_data_access_log에 접근 기록
6. generateViaLlm(): callStructuredLlm으로 Claude 호출 (최대 2회 재시도)
   → 응답이 violatesOutputPolicy()(진단/처방 표현 금지어)에 걸리면 그 결과를 버리고 재시도
   → 통과하면 sanitizeLlmTextArray()로 XML 태그 흔적 제거 후 반환
7. LLM 결과가 끝내 없으면(2회 모두 실패) → 검수 가이드 원문(referenceGuide.must_avoid 등)을
   그대로 사용 → generatedBy: "reference_guide" (503 대신 200으로 안전하게 폴백)
8. 결과를 aftercare_guides에 insert해 캐시화 (unique(care_record_id, generated_date))
   → 동시 요청으로 insert 충돌 나면 방금 다른 요청이 만든 캐시를 재조회해서 반환(레이스 처리)
```

핵심은 3번과 4번이다 — **경과 구간(`elapsedRange`) 판정과 근거 텍스트 선정은 LLM이 아니라
`reference_guides` 테이블 lookup이 먼저 결정**하고, LLM은 그 안에서 문장을 다듬고 환자
개인 정보(알러지 등)를 반영해 강조하는 역할만 한다. LLM이 완전히 실패해도 4번에서 이미 찾아둔
검수 원문이 있으므로 최소한의 안전한 응답은 항상 보장된다.

### 5-2. `POST /aftercare/questions` → `submitQuestion`

```
1. isSupportedCategory() 체크 — 미지원 카테고리는 422 (LLM 호출 전 차단)
2. containsRiskKeyword(question) 체크 — lib/riskKeywords.ts의 키워드(통증/출혈/호흡곤란 등)에
   매칭되면 LLM을 아예 호출하지 않고 즉시 status: "expert_required"로 저장·응답
3. 위험 신호가 아니면 getMedicalProfileForLlmContext() + findReferenceGuide()로 컨텍스트 조립
4. callStructuredLlm으로 Claude 호출 (최대 2회 재시도, violatesOutputPolicy 통과해야 함)
   → LLM이 스스로 status: "out_of_scope"를 반환할 수도 있음(근거 부족 판단은 LLM 몫)
5. 결과를 questions 테이블에 저장 후 status에 따라 응답 형태 분기
   (answered / out_of_scope / expert_required)
6. 2회 재시도 후에도 실패하면 503 ANSWER_GENERATION_FAILED (daily-guide와 달리 폴백 문구를
   만들기 어려워 문서(api-spec.md)대로 에러 유지)
```

`containsRiskKeyword`(2단계, 규칙 기반)와 `status: "out_of_scope"`(4단계, LLM 판단)는
서로 다른 계층의 안전장치다 — 전자는 위험할 수 있는 신체 증상 키워드를 LLM 호출 전에
정규식 수준으로 즉시 차단하고, 후자는 LLM이 컨텍스트를 보고 "이 앱 범위 밖의 질문"이라고
스스로 판단한 경우다.

### 5-3. 공통 부품

- **`services/llm/client.ts` (`callStructuredLlm`)**: Claude Messages API를
  `tool_choice: { type: "tool", name }`로 호출해 **자유 텍스트가 아니라 지정한 JSON 스키마로만
  응답하도록 강제**한다. 응답의 `tool_use` 블록을 찾아 `input`을 그대로 반환 — 텍스트 파싱/정규식
  추출이 전혀 없다.
- **`services/llm/dailyGuide.prompt.ts` / `questions.prompt.ts`**: 시스템 프롬프트 원문,
  도구 이름, JSON 스키마, 그리고 컨텍스트 객체를 LLM 입력 문자열로 조립하는 함수
  (`buildDailyGuideUserMessage` / `buildQuestionUserMessage`)를 각각 정의한다. 두 프롬프트 모두
  "검수된 가이드에 없는 내용을 지어내지 마라", "진단/처방 금지"를 명시하고, 알러지/기저질환이
  있으면 반드시 반영하라고 지시한다.
- **`lib/riskKeywords.ts`**: `RISK_KEYWORDS`(입력 사전 차단용)와
  `FORBIDDEN_OUTPUT_PATTERNS`(LLM 출력 검증용, `violatesOutputPolicy`)를 분리해서 관리한다.
  전자는 사용자 질문을, 후자는 LLM이 생성한 문장을 검사한다는 방향이 다르다.
  **둘 다 전문가(의료진) 검수 전 초안**이라는 점이 코드 주석과 README에 명시돼 있다.
- **`lib/sanitizeLlmText.ts`**: Claude가 tool-use 입력 필드 안에 `</answer>`, `</invoke>` 같은
  XML 태그 흔적을 남기는 버그를 발견해(엔드투엔드 테스트 중) 추가한 후처리 — 사용자에게 노출되는
  모든 LLM 생성 텍스트는 응답 직전 반드시 이 함수를 거친다.
- **`services/medicalProfile.service.ts`**: 알러지/기저질환처럼 민감한 정보는 이 함수를 통해서만
  조회하도록 강제하고, 조회할 때마다 `medical_data_access_log`에 "누가/언제/어떤 요청 컨텍스트로
  이 필드를 봤는지" 감사 로그를 남긴다 — 의료 인접 도메인이라는 특성을 반영한 설계.
- **`services/referenceGuides.service.ts`**: `care_type` + `daysElapsed`로 검수 가이드 구간을
  찾는 단순 lookup. 현재 시드 데이터는 `peeling`/`laser_toning` 2종뿐이라 다른 관리 유형은
  404 `GUIDE_NOT_AVAILABLE`이 발생한다(확장 필요).

---

## 6. My Care — 관리 이력 / 이용권 (`services/careRecords.service.ts`, `services/memberships.service.ts`)

- 캘린더(`getCalendarSummary`), 목록(`listCareRecords`), 상세(`getCareRecordById`)가 모두
  같은 `care_records` 테이블을 다른 방식으로 질의할 뿐이다. 캘린더는 월별로 `care_date`만 모아
  날짜별 카운트로 집계하고(`Map`으로 그룹핑), 목록은 `dateFrom/dateTo/partOfBody/brand` 쿼리를
  그대로 Supabase 쿼리 빌더에 조건부로 얹는다 — API 문서에서 말한 "캘린더 날짜 클릭 = 목록 API를
  `dateFrom=dateTo`로 재호출"이 실제로 별도 엔드포인트 없이 동일 함수로 처리된다.
- **`daysElapsedSince`**: KST 자정 기준으로 날짜만 비교해 경과일을 계산한다(시:분:초 오차로
  하루가 밀리거나 당겨지지 않도록 두 날짜 모두 `setHours(0,0,0,0)`으로 맞춘 뒤 뺀다). 이 함수가
  `aftercare.service.ts`(daily-guide/questions)와 `recommendations.service.ts`(추천 조건)
  모두에서 재사용되는 공통 시간 계산 기준점이다.
- **`memberships.service.ts`**: 단순 CRUD 성격의 조회 3종(`listMemberships`,
  `getMembershipById`, `getNearestExpiringMembership`) + 홈 요약용 카운트(`countMemberships`).

---

## 7. 설정 / 프로필 / 알림 (`services/profile.service.ts`, `services/notifications.service.ts`)

- 프로필의 이메일은 `profiles` 테이블이 아니라 `supabaseAdmin.auth.admin.getUserById`로 Supabase
  Auth 쪽에서 가져온다 — 이메일은 Auth가 진실 소스(source of truth)이고, `profiles`는 이름/관심
  목표/알림 설정 같은 애플리케이션 고유 데이터만 갖고 있다.
- **FCM 디바이스 토큰** (`registerDeviceToken`/`unregisterDeviceToken`): `api-spec.md`에 없던
  Android 전용 확장 엔드포인트의 구현체. `upsert(..., { onConflict: "fcm_token" })`을 써서 같은
  토큰이 다른 계정으로 재등록되는 경우(기기 공유 로그아웃/로그인)에도 항상 최신 `user_id`로 덮어쓴다.
- **`services/push.service.ts` (`sendPushToUser`)**: 실제 푸시를 쏘는 함수는 준비돼 있지만,
  이 함수를 정기적으로 호출하는 스케줄러/배치(아침 리마인더 등)는 아직 없다 — **배선만 된 상태**.
  `config/firebase.ts`는 `FCM_ENABLED=false`면 Firebase Admin SDK 초기화 자체를 건너뛰어, 서비스
  계정 JSON이 없는 해커톤 초기 단계에도 서버가 정상 기동하도록 만들어져 있다.

---

## 8. 설정/환경 (`config/*.ts`)

- **`config/env.ts`**: `zod`로 모든 환경변수를 파싱·검증하고, 실패하면 서버 기동 자체를 막는다
  (설정 오류를 런타임 중간이 아니라 부팅 시점에 즉시 드러냄). `FCM_ENABLED`처럼
  "아직 실제 연동 전"인 기능은 boolean 플래그로 켜고 끌 수 있게 했다.
- **`config/supabase.ts`**: `supabaseAdmin`(service-role, RLS 우회, 백엔드 전용)과
  `supabaseAnon`(로그인/토큰 검증처럼 사용자 컨텍스트가 필요한 호출 전용) 두 클라이언트를 분리한다.
  `supabaseAdmin`은 RLS를 우회하므로, **`user_id` 필터링은 항상 애플리케이션 코드(서비스 함수)가
  책임진다** — 이 전제가 깨지면 다른 사용자 데이터가 노출될 수 있다는 점에 유의.

---

## 9. 코드 기준으로 본 "문서와 다르게 구현된 부분"

(`server/README.md`의 "api-spec.md 대비 구현 시 추가/확정한 사항"과 동일 내용을 코드 위치 기준으로 재정리)

| 항목 | 문서(api-spec.md) | 실제 코드 |
|---|---|---|
| daily-guide LLM 실패 | `503 GUIDE_GENERATION_FAILED` | `aftercare.service.ts:getOrGenerateDailyGuide` — 검수 가이드로 자동 폴백, 200 응답 |
| questions LLM 실패 | `503 ANSWER_GENERATION_FAILED` | 동일하게 503 유지 (`submitQuestion` 마지막 `if (!llmOutput) throw ...`) |
| 검수 가이드 저장 위치 | 미확정 | `reference_guides` 테이블 (`referenceGuides.service.ts`) |
| FCM 디바이스 토큰 | 문서에 없음 | `notifications.routes.ts`의 `POST/DELETE /device-token` 신규 |
| `care_records.care_type` | 문서에 없음 | 검수 가이드 매칭용 내부 키, Android 응답 DTO에는 노출 안 함(`toCareRecordSummary` 참고) |

### v0.5 신규 항목 — 구현·마이그레이션·시드 전부 완료

최종 와이어프레임 검토로 `api-spec.md`가 v0.4 → v0.5로 갱신되며 추가된 9개 항목은 **서버 코드 구현, `server/db/migrations/003_v05_wireframe_features.sql` Supabase 적용, `npm run seed` 재시드까지 완료돼 실제 DB에서 동작 확인됐다.**

| 항목 | api-spec.md 위치 | 구현 위치 | 마이그레이션 |
|---|---|---|---|
| `POST /auth/password/reset-request`, `/reset-confirm` | 1절 | `auth.routes.ts`/`auth.service.ts` — `supabaseAnon.auth.resetPasswordForEmail`/`verifyOtp` + `supabaseAdmin.auth.admin.updateUserById` | 불필요 |
| `POST /profile/password` | 5절 | `profile.routes.ts`/`profile.service.ts` — `signInWithPassword` 재검증 후 `updateUserById` | 불필요 |
| `NotificationSettings.marketingAlert` | 5절 | `notifications.service.ts` | `profiles.marketing_alert` — 적용 완료 |
| `Profile.birthDate`/`phone` | 5절 | `profile.service.ts` | `profiles.birth_date` — 적용 완료 |
| `Membership.usageHistory` | 4절 | `memberships.service.ts` — `membership_usages` 조인 후 JS에서 회차순 정렬 | `public.membership_usages` 신규 테이블 — 적용 완료 |
| `CareRecord.status`/`daysElapsed`/`session`/`membership` | 4절 | `careRecords.service.ts` — `daysElapsed`는 기존 `daysElapsedSince` 재사용, `membership`은 FK 임베드(`memberships(id, product_name)`) | `care_records.status`/`session_number`/`total_sessions`/`membership_id` — 적용 완료 |
| `GET /aftercare/daily-guide?elapsedDay=` | 3절 | `aftercare.service.ts` — `elapsedDay`가 오늘과 다르면 `getReferenceGuidePreview()`로 분기해 LLM 생략, `isToday` 필드로 구분 | 불필요 |
| 추천 상세 확장 3종(`relatedRecentCares` 등) | 2절 | `recommendations.service.ts` — `listRecentCareRecords()` + 키워드 기반 태그 매핑(`POPULAR_TAG_RULES`) | 불필요 |

마이그레이션 003은 이미 Supabase 프로젝트에 적용됐고(001·002 위에 누적), 데모 데이터도 `npm run seed`로 재시드해 새 필드가 채워진 상태를 직접 조회로 검증했다.

---

## 10. 앞으로 코드를 볼 때 참고할 포인트

- 새 엔드포인트를 추가한다면: `routes/*.routes.ts`(얇은 매핑) → `validators/*.ts`(zod 스키마) →
  `services/*.ts`(실제 로직)의 3단 구조를 그대로 따르는 것이 기존 코드와 일관된다.
- LLM 호출 지점은 코드 전체에서 `services/aftercare.service.ts` 딱 2곳(`generateViaLlm` 내부,
  `submitQuestion` 내부)뿐이다 — 다른 곳에서 Claude를 호출하는 코드는 없다.
- `lib/riskKeywords.ts`의 두 목록은 전문가 검수 전 초안이므로, 실제 서비스 오픈 전 반드시
  의료진 검토가 필요하다(`.work-log/current.md`의 "다음 할 일" 항목).
