# WHS After Mate — 서버 코드 설명서 (v0.5)

`api-spec.md`가 "각 엔드포인트를 호출하면 무엇을 주고받는가"를 정의한 계약서라면,
이 문서는 **그 계약을 `server/src` 코드가 실제로 어떻게 구현하는가**를 설명한다.
파일 경로·함수명 기준으로 작성했으므로 코드와 나란히 두고 보는 것을 전제로 한다.

이 문서는 고객용 백엔드 `server/`만 다룬다. 관리자용 백엔드 `server_admin/`(환자 등록, 시술기록/이용권 입력, 가입 인증코드 발급 — 포트 4100)은 `server/`와 동일한 3단 컨벤션(routes/services/validators)으로 별도 구축돼 있으며, 상세는 `server_admin/README.md` 참고.

대상 커밋: `16c2f5f` (2026-08-02, 백엔드 1차 구현 + Supabase/Anthropic 연동 + 엔드투엔드 테스트 완료 시점) + v0.5 신규 항목 9건(2026-08-05, 9절 "v0.5 신규 항목" 참고) + v0.6 회원가입 재설계(환자번호+인증코드 → 환자번호+이름+생년월일 대조, 2026-08-13~08-16, 3절·9-2절 참고) + 비밀번호 재설정 숫자코드화·`interestGoals`(2026-08-16, 9-2절 참고) + **v0.4(이 문서) 갱신 시점 기준 코드**: LLM 제공자는 Anthropic Claude가 아니라 **OpenAI**로 전환됐고(v0.13, `llm-prompt-design.md` 참고), daily-guide는 LLM을 호출하지 않는 `treatment_guides` 직접 조회로 바뀌었다(v0.5, 5절 참고) — 아래 5절은 이 최신 상태를 반영해 전면 재작성했다.

---

## 1. 레이어 구조와 책임

```
src/
  server.ts      → app.listen (프로세스 진입점)
  app.ts         → express 인스턴스 조립 (미들웨어 순서 결정)
  routes/        → URL·HTTP 메서드 ↔ 서비스 함수 연결, req/res만 다룸 (비즈니스 로직 없음)
  validators/    → zod 스키마 — 요청 바디/쿼리 검증 (routes에서만 호출)
  services/      → 도메인 로직 + DB(Supabase) 접근. **DB 접근은 반드시 이 레이어를 통해서만 한다**
    services/llm/ → OpenAI 프롬프트 정의 + 구조화 출력 호출 클라이언트(questions/recommendation 2곳만 — daily-guide는 LLM을 호출하지 않음, 5절 참고)
  middleware/    → 인증(requireAuth), 공통 에러 핸들러
  lib/           → 상태 없는 순수 유틸(에러 정의, 위험신호 키워드, sanitize 등)
  config/        → 외부 서비스 클라이언트 초기화(Supabase, OpenAI, Firebase) + 환경변수 스키마
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
함께 삭제됐다.

**회원가입은 v0.6에서 환자번호+인증코드 기반으로 전면 재작성됐다가, 같은 v0.6 범위 안에서 다시 인증코드 없이 환자번호+이름+생년월일 대조 방식으로 단순화됐다**(마이그레이션 010) — "환자가 앱에 가입하기 전에 의료진(`server_admin`/`admin-web`)이 먼저 시술 이력을 입력해둔다"는 실제 클리닉 흐름을 반영한 것은 그대로다.

1. `POST /signup({ patientNo, name, birthDate, email, password, interestGoals })` → `signup`
   - `emr_patients`에서 `patient_no`로 환자를 조회한다. 없으면 `patientNotFound()`, 이미 `claimed_user_id`가 있으면(다른 계정이 먼저 가입) `patientAlreadyClaimed()`로 차단
   - 조회된 레코드의 `name`/`birth_date`가 요청값과 정확히 일치하는지 대조한다. 불일치하면 `patientIdentityMismatch()` — 별도 인증코드 발급/대조 단계는 없다(`signup_verification_codes` 테이블 자체가 삭제됨, `lib/errors.ts`에서 `invalidOrExpiredVerificationCode`도 함께 제거)
   - `supabaseAdmin.auth.admin.createUser`로 계정 생성(이메일/비밀번호만 이 단계에서 클라이언트 입력값 사용)
   - 생성된 `user.id`로 다음을 순서대로 처리한다 — 이름/전화/생년월일은 **클라이언트 입력이 아니라 `emr_patients` 원본 값**을 그대로 사용:
     1. `profiles` insert (`name`/`phone`/`birth_date`는 `emr_patients` 값, `interest_goals`는 요청값 그대로 — 생략 시 빈 배열)
     2. `medical_profiles` insert (`emr_patients.notes` — 알러지/기저질환/의사소견을 통합한 자유입력 텍스트 — 를 그대로 `doctor_general_comment`로 옮긴다. `allergies`/`chronic_conditions`는 더 이상 구조화 입력을 받지 않아 빈 배열)
     3. `emr_care_records`를 해당 `patient_id`로 전부 조회해 `care_records`로 매핑·insert (있으면)
     4. `emr_memberships`를 동일하게 `memberships`로 매핑·insert (있으면)
     5. `emr_patients.claimed_user_id`/`claimed_at` 기록
   - 1~5 중 하나라도 실패하면 `catch` 블록에서 방금 만든 Auth 유저를 `deleteUser`로 롤백한다. `profiles`/`medical_profiles`/`care_records`/`memberships`는 `auth.users`에 CASCADE로 걸려있어 유저 삭제 시 함께 정리되고, `emr_patients`는 이 단계에서 아직 claim 처리 전(트랜잭션 밖)이라 그대로 남아 재시도 가능하다
   - 마지막으로 내부적으로 `login()`을 호출해 응답 스키마를 로그인과 동일하게 맞춘다
   - **Supabase에 실제 트랜잭션(BEGIN/COMMIT)을 쓰지 않는다** — 여러 insert를 순서대로 실행하고 실패 시 Auth 유저 롤백으로 정합성을 맞추는 애플리케이션 레벨 보정 방식. `emr_patients`가 claim 이전까지 원본 그대로 보존되는 설계 덕에 이 방식이 안전하게 성립한다
2. `POST /login` / `POST /refresh` / `POST /logout`
   - 이 세 개는 자체 로직 없이 **Supabase Auth를 그대로 감싸는 얇은 래퍼**다:
     `supabaseAnon.auth.signInWithPassword` / `refreshSession` / `supabaseAdmin.auth.admin.signOut(..., "global")`.
     accessToken/refreshToken의 실제 발급·검증·만료 정책은 Supabase 쪽 설정을 따른다
     (→ "미확정 사항": refreshToken 만료 정책은 Supabase 기본값 그대로 사용 중).
3. `POST /password/reset-request` / `POST /password/reset-verify` / `POST /password/reset-confirm`
   - `reset-request`는 `supabaseAnon.auth.resetPasswordForEmail()`에 그대로 위임 — 가입 여부와 무관하게 항상 204
   - `reset-verify`(신규)는 `{email, code}`를 받아 `code`를 `supabaseAnon.auth.verifyOtp({ email, token: code, type: "recovery" })`로 검증하고, 성공하면 그 recovery 세션의 `access_token`을 `resetToken`으로 응답한다(`auth.service.ts`의 `verifyPasswordResetCode`). **코드는 이 호출 시점에 소진되어 재사용 불가** — 와이어프레임(`docs/After_Mate.png` 05번)이 "인증번호 확인"을 "비밀번호 변경"과 별도 버튼으로 그려서 코드 검증을 독립 단계로 뺐다
   - `reset-confirm`은 이제 `{resetToken, newPassword}`만 받는다(더 이상 `email`/`code`를 직접 받지 않음) — `resetToken`을 `supabaseAnon.auth.getUser(resetToken)`으로 재확인한 뒤 `supabaseAdmin.auth.admin.updateUserById(userId, { password })`로 갱신한다(`auth.service.ts`의 `confirmPasswordReset`) — 실패 시 `invalidOrExpiredResetToken()`(에러 코드는 `INVALID_OR_EXPIRED_RESET_CODE`). 코드 자릿수는 "6자리"가 표준이 아니라 Supabase 프로젝트 설정에 따라 다르다(이 프로젝트는 실측 8자리) — `passwordResetVerifySchema`는 6~10자리를 느슨하게 허용. 발송→확인→변경→새 비밀번호 로그인까지 라이브 실측 검증 완료(코드 재사용 거부도 확인)

---

## 4. 홈 / 추천 (`services/home.service.ts`, `services/recommendations.service.ts`)

- **`getHomeSummary`**: 홈 진입 1회 호출을 위해 4가지를 병렬로 모은다 — 최근 관리
  (`careRecords.service.getLatestCareRecord`), 오늘자 사후관리 가이드 카드
  (`(v0.5)` `treatment_guides`를 시술명+오늘 경과일로 직접 조회 — daily-guide(5-1절)와 동일한
  소스, LLM 호출 없음), 이용권 요약
  (`memberships.service.countMemberships` + `getNearestExpiringMembership`), 다음 관리 추천
  (`recommendations.service.computeNextCareRecommendation`). LLM 호출은 여기서 발생하지 않는다 —
  매칭이 없으면 `aftercareCard: null`을 반환한다.
- **`computeNextCareRecommendation`**: 이름과 달리 **규칙 기반, LLM 미사용**. 최근 관리 후
  경과일이 `MIN_INTERVAL_DAYS(21일)` 이상인지, 보유 이용권 중 잔여 횟수가 있는 관리명인지,
  관심 목표(`profiles.interest_goals`)와 이름이 매칭되는지를 순서대로 확인해 `reasons`/`basis`
  배열을 채운다. 추천 대상이 없으면 `null` → 라우트에서 `204`로 변환.
  `recommendationId`는 DB에 저장하지 않고 `sha1("recommendation:" + userId)`로 매번 같은 값을
  만드는 **결정론적 해시**다(`recommendationIdFor`) — 그래서 상세 조회(`getNextCareRecommendationDetail`)는
  추천을 다시 계산한 뒤 id가 일치하는지만 확인하는 방식으로 동작한다.

---

## 5. 사후관리 안내·Q&A·추천 — LLM 파이프라인 (`services/aftercare.service.ts`, `services/recommendations.service.ts`)

`docs/llm-prompt-design.md`에서 정의한 원칙(구조화 출력 강제, 의료적 진단 금지, 위험 신호 사전 차단)을
실제로 구현한 코드다. **LLM 호출 지점은 questions와 recommendation 두 곳뿐이다** — daily-guide는
`(v0.5)` LLM을 아예 호출하지 않는 단순 DB 조회로 바뀌었다. LLM 제공자는 `(v0.13)` OpenAI다
(`config/openai.ts`, `OPENAI_MODEL` 환경변수, 기본값 `gpt-4.1-mini`).

### 5-1. `GET /aftercare/daily-guide` → `getOrGenerateDailyGuide` — LLM을 호출하지 않는다

```
1. careRecordId 지정 없으면 최근 관리 이력 사용 (getLatestCareRecord)
2. daysElapsedSince()로 경과일 계산(elapsedDay 쿼리가 있으면 그 값 사용)
3. findTreatmentGuide(care_name, day) — services/treatmentGuides.service.ts — 로
   treatment_guides 테이블을 (care_name, day) 정확히 일치 조회
   → 못 찾으면 404 GUIDE_NOT_AVAILABLE (여기서 끝, LLM 호출도 캐시도 없음)
4. 찾은 행의 aftercare/precautions/key_care를 그대로 응답에 담아 반환
   (generatedBy: "treatment_guide", nextCheckDate/elapsedRange/cacheExpiresAt는 항상 null)
```

`(v0.5 이전)` 여기엔 LLM 호출(`generateViaLlm`)과 하루 1회 캐시(`aftercare_guides`)가 있었다.
`docs/llm-prompt-design.md`의 "1. daily-guide" 절에 그 시절 프롬프트 전문과 왜 없어졌는지가
남아있다 — 요약하면 "`care_type` 그룹 단위 근거로는 시술별 특성을 못 담는다"는 문제를 LLM의
판단력으로 완화하려던 v0.4 시도가 근본 해결이 아니었고, 결국 시술명 단위로 팀이 콘텐츠를 직접
쓰는 쪽(`treatment_guides`)으로 바뀌며 LLM이 종합할 필요 자체가 없어졌다.

### 5-2. `POST /aftercare/questions` → `submitQuestion`

```
1. isSupportedCategory() 체크 — 미지원 카테고리는 422 (LLM 호출 전 차단)
2. containsRiskKeyword(question) 체크 — lib/riskKeywords.ts의 키워드(통증/출혈/호흡곤란 등)에
   매칭되면 LLM을 아예 호출하지 않고 즉시 status: "expert_required"로 저장·응답
3. 위험 신호가 아니면 getMedicalProfileForLlmContext() + findTreatmentGuide()로 컨텍스트 조립
   (treatment_guides 매칭 실패 시 treatmentGuide: null로 그냥 진행 — daily-guide와 달리
   여기선 404로 막지 않는다, 자유 질문이라 근거가 없어도 일반론 수준으로는 답할 수 있어서)
4. callStructuredLlm으로 OpenAI 호출 (최대 2회 재시도, violatesOutputPolicy 통과해야 함)
   → LLM이 스스로 status: "out_of_scope"를 반환할 수도 있음(근거 부족 판단은 LLM 몫)
   → consultationLevel(NONE/RECOMMENDED/URGENT)도 이 호출에서 함께 판단됨(v0.4)
5. 결과를 questions 테이블에 저장 후 status에 따라 응답 형태 분기
   (answered / out_of_scope / expert_required)
6. 2회 재시도 후에도 실패하면 503 ANSWER_GENERATION_FAILED
```

`containsRiskKeyword`(2단계, 규칙 기반)와 `status: "out_of_scope"`(4단계, LLM 판단)는
서로 다른 계층의 안전장치다 — 전자는 위험할 수 있는 신체 증상 키워드를 LLM 호출 전에
정규식 수준으로 즉시 차단하고, 후자는 LLM이 컨텍스트를 보고 "이 앱 범위 밖의 질문"이라고
스스로 판단한 경우다.

### 5-3. `GET /recommendations/next-care`(및 상세) → `generateRecommendationCopy`

어떤 시술을 추천할지(후보 선정)는 여전히 규칙 기반(`scoreProcedures` — 관심목표/최근 시술의
`category_tags` 매칭 점수)이고, LLM은 이미 정해진 1개 시술에 대해 "왜 추천하는지" 자연어
`reasons`(정확히 3개, 각 30자 이내)/`detailDescription`(30~40자)만 생성한다.

```
1. computeNextCareRecommendation()이 규칙 기반으로 추천 시술 1개를 확정
2. generateRecommendationCopy(): callStructuredLlm으로 OpenAI 호출 (최대 2회 재시도)
   → reasons.length !== 3이거나 detailDescription이 없으면 재시도
3. 통과하면 sanitizeLlmTextArray/sanitizeLlmText 후 truncate()로 길이 강제(30/40자 초과분 자름)
4. 2회 모두 실패하거나 OPENAI_API_KEY 미설정이면 → 정적 템플릿 문구로 조용히 폴백(200,
   에러 없음) — daily-guide/questions와 달리 "추천 자체가 안 뜨는" 상황을 만들지 않는다
```

결과는 DB에 저장하지 않는다 — 매 요청마다 다시 계산(캐싱 없음).

### 5-4. 공통 부품

- **`services/llm/client.ts` (`callStructuredLlm`)**: OpenAI `chat.completions.create`를
  `tools`+`tool_choice: { type: "function", function: { name } }`로 호출해 **자유 텍스트가 아니라
  지정한 JSON 스키마로만 응답하도록 강제**한다. 응답의 `tool_calls[0].function.arguments`를
  `JSON.parse`해 그대로 반환 — 텍스트 파싱/정규식 추출이 전혀 없다. questions/recommendation
  **2곳**이 이 함수를 공유한다.
- **`services/llm/questions.prompt.ts` / `recommendation.prompt.ts`**: 시스템 프롬프트 원문,
  도구 이름, JSON 스키마, 그리고 컨텍스트 객체를 LLM 입력 문자열로 조립하는 함수
  (`buildQuestionUserMessage` / `buildRecommendationUserMessage`)를 각각 정의한다.
  `(v0.5 이전엔 여기에 dailyGuide.prompt.ts도 있었으나 삭제됨.)`
- **`services/treatmentGuides.service.ts` (`findTreatmentGuide`)**: `(v0.5 신설)` `care_name`+
  `day`로 `treatment_guides`를 조회하는 단순 lookup. daily-guide(5-1)는 이 결과를 그대로
  응답으로 쓰고, questions(5-2)는 이 결과를 LLM 컨텍스트(`reviewedGuide`)로 주입한다.
  `(v0.5 이전엔 `services/referenceGuides.service.ts`가 `care_type`+`daysElapsed` 기준으로
  이 역할을 했으나, 그 테이블·서비스 모두 삭제됐다.)`
- **`lib/riskKeywords.ts`**: `RISK_KEYWORDS`(입력 사전 차단용)와
  `FORBIDDEN_OUTPUT_PATTERNS`(LLM 출력 검증용, `violatesOutputPolicy`)를 분리해서 관리한다.
  전자는 사용자 질문을, 후자는 LLM이 생성한 문장을 검사한다는 방향이 다르다.
  **둘 다 전문가(의료진) 검수 전 초안**이라는 점이 코드 주석과 README에 명시돼 있다.
- **`lib/sanitizeLlmText.ts`**: LLM이 tool-use 입력 필드 안에 `</answer>`, `</invoke>` 같은
  XML 태그 흔적을 남기는 버그를 발견해(엔드투엔드 테스트 중, 당시 Claude 사용 시절) 추가한
  후처리 — 사용자에게 노출되는 모든 LLM 생성 텍스트는 응답 직전 반드시 이 함수를 거친다.
- **`services/medicalProfile.service.ts`**: 알러지/기저질환처럼 민감한 정보는 이 함수를 통해서만
  조회하도록 강제하고, 조회할 때마다 `medical_data_access_log`에 "누가/언제/어떤 요청 컨텍스트로
  이 필드를 봤는지" 감사 로그를 남긴다 — 의료 인접 도메인이라는 특성을 반영한 설계.

---

## 6. My Care — 관리 이력 / 이용권 (`services/careRecords.service.ts`, `services/memberships.service.ts`)

- 캘린더(`getCalendarSummary`), 목록(`listCareRecords`), 상세(`getCareRecordById`)가 모두
  같은 `care_records` 테이블을 다른 방식으로 질의할 뿐이다. 캘린더는 월별로 `care_date`만 모아
  날짜별 카운트로 집계하고(`Map`으로 그룹핑), 목록은 `dateFrom/dateTo/partOfBody/brand` 쿼리를
  그대로 Supabase 쿼리 빌더에 조건부로 얹는다 — API 문서에서 말한 "캘린더 날짜 클릭 = 목록 API를
  `dateFrom=dateTo`로 재호출"이 실제로 별도 엔드포인트 없이 동일 함수로 처리된다.
- **`daysElapsedSince`**: KST 자정 기준으로 날짜만 비교해 경과일을 계산한다(시:분:초 오차로
  하루가 밀리거나 당겨지지 않도록 두 날짜 모두 `setHours(0,0,0,0)`으로 맞춘 뒤 뺀다). 미래
  `care_date`가 들어와도 음수를 내지 않고 `Math.max(0, ...)`로 항상 0 이상으로 클램프한다. 이 함수가
  `aftercare.service.ts`(daily-guide/questions)와 `recommendations.service.ts`(추천 조건)
  모두에서 재사용되는 공통 시간 계산 기준점이다.
- **`getLatestCareRecord`/`listRecentCareRecords`** `(v0.4 갱신 시점 수정)`: `care_date <= 오늘(KST)`
  조건이 있다 — `server_admin`이 예약(미래 `care_date`) 등록을 지원하면서, 이 조건이 없으면
  아직 받지도 않은 미래 예약이 "가장 최근 관리"로 뽑혀 `daysElapsedSince`가 0으로 클램프된 값을
  daily-guide/챗봇에 "오늘이 시술 당일"처럼 잘못 전달하는 버그가 실사용 중 발견됐다(`kstToday()`
  헬퍼로 KST 기준 오늘 날짜 문자열을 계산해 `.lte("care_date", ...)`로 거른다).
- **`memberships.service.ts`**: 단순 CRUD 성격의 조회 3종(`listMemberships`,
  `getMembershipById`, `getNearestExpiringMembership`) + 홈 요약용 카운트(`countMemberships`).

---

## 7. 설정 / 프로필 / 알림 (`services/profile.service.ts`, `services/notifications.service.ts`)

- 프로필의 이메일은 `profiles` 테이블이 아니라 `supabaseAdmin.auth.admin.getUserById`로 Supabase
  Auth 쪽에서 가져온다 — 이메일은 Auth가 진실 소스(source of truth)이고, `profiles`는 이름/생년월일/관심
  목표 같은 애플리케이션 고유 데이터만 갖고 있다.
- **FCM 디바이스 토큰** (`registerDeviceToken`/`unregisterDeviceToken`): `api-spec.md`에 없던
  Android 전용 확장 엔드포인트의 구현체. `upsert(..., { onConflict: "fcm_token" })`을 써서 같은
  토큰이 다른 계정으로 재등록되는 경우(기기 공유 로그아웃/로그인)에도 항상 최신 `user_id`로 덮어쓴다.
- **`services/push.service.ts` (`sendPushToUser`)**: `(v0.4 갱신 시점)` 이제 **실제로 정기 호출된다**
  — `services/notificationScheduler.service.ts`가 `node-cron`으로 매일 09:00 KST(일차별
  마일스톤 1/3/5/7/14일, 이용권 만료 30일/7일 전)와 19:00 KST(당일 시술 등록 안내)에 대상을
  조회해 이 함수를 호출한다(`server.ts`가 `FCM_ENABLED=true`일 때만 `startNotificationScheduler()`
  기동). `notification_log` 테이블에 먼저 insert를 시도해 성공한 경우에만 실제 발송하는 순서라
  (claim-then-send), 크론이 겹쳐 돌아도 중복 발송되지 않는다. `sendPushToUser`는 발송 전
  `profiles.care_notification`/`marketing_notification`(`GET/PATCH /profile/notifications`로
  사용자가 켜고 끔)을 확인해 꺼져 있으면 스킵한다.
  `config/firebase.ts`는 `FCM_ENABLED=false`면 Firebase Admin SDK 초기화 자체를 건너뛰어, 서비스
  계정 JSON이 없는 환경에도 서버가 정상 기동하도록 만들어져 있다.

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
| daily-guide LLM 실패 | *(v0.16 기준 해당 없음)* | `(v0.5)` LLM을 아예 호출하지 않으므로 "생성 실패"라는 상태 자체가 없음 — `treatment_guides` 매칭 실패는 곧바로 `404 GUIDE_NOT_AVAILABLE` |
| questions LLM 실패 | `503 ANSWER_GENERATION_FAILED` | 동일하게 503 유지 (`submitQuestion` 마지막 `if (!llmOutput) throw ...`) |
| 사후관리 콘텐츠(RAG) 저장 위치 | `db-schema.md`에 확정 | `(v0.5)` `treatment_guides` 테이블(`care_name`+`day` 단위, 팀 작성) — `treatmentGuides.service.ts` |
| FCM 디바이스 토큰 | 문서화됨(`api-spec.md`) | `notifications.routes.ts`의 `POST/DELETE /device-token` |
| 알림 설정/발송 | `(v0.16)` 문서화됨 | `GET/PATCH /profile/notifications` + `notificationScheduler.service.ts`(크론) + `notification_log`(중복 방지) |
| `care_records.care_type` | 문서에 없었음 | `(v0.5)` 컬럼 자체가 삭제됨(`024`) — daily-guide/questions 매칭 키가 `care_name`+경과일로 전환되며 더 이상 필요 없어짐 |

### v0.5 신규 항목 — 구현·마이그레이션·시드 전부 완료

최종 와이어프레임 검토로 `api-spec.md`가 v0.4 → v0.5로 갱신되며 추가된 9개 항목은 **서버 코드 구현, `server/db/migrations/003_v05_wireframe_features.sql` Supabase 적용, `npm run seed` 재시드까지 완료돼 실제 DB에서 동작 확인됐다.**

| 항목 | api-spec.md 위치 | 구현 위치 | 마이그레이션 |
|---|---|---|---|
| `POST /auth/password/reset-request`, `/reset-confirm` | 1절 | `auth.routes.ts`/`auth.service.ts` — `supabaseAnon.auth.resetPasswordForEmail`/`verifyOtp` + `supabaseAdmin.auth.admin.updateUserById` (v0.6에서 `/reset-verify`로 코드 검증 단계 분리, 3절 참고) | 불필요 |
| `POST /profile/password` | 5절 | `profile.routes.ts`/`profile.service.ts` — `signInWithPassword` 재검증 후 `updateUserById` | 불필요 |
| ~~`NotificationSettings.marketingAlert`~~ | 5절 | *(제거됨 — `GET`/`PATCH /notifications/settings` 자체를 삭제. 실제로 읽는 발송 로직이 없는 placeholder였음)* | `db/migrations/005_remove_notification_settings.sql` |
| `Profile.birthDate`/`phone` | 5절 | `profile.service.ts` | `profiles.birth_date` — 적용 완료 |
| `Membership.usageHistory` | 4절 | `memberships.service.ts` — `membership_usages` 조인 후 JS에서 회차순 정렬 | `public.membership_usages` 신규 테이블 — 적용 완료 |
| `CareRecord.status`/`daysElapsed`/`session`/`membership` | 4절 | `careRecords.service.ts` — `daysElapsed`는 기존 `daysElapsedSince` 재사용, `membership`은 FK 임베드(`memberships(id, product_name)`) | `care_records.status`/`session_number`/`total_sessions`/`membership_id` — 적용 완료 |
| `GET /aftercare/daily-guide?elapsedDay=` | 3절 | `aftercare.service.ts` — `elapsedDay`가 오늘과 다르면 `getReferenceGuidePreview()`로 분기해 LLM 생략, `isToday` 필드로 구분 | 불필요 |
| 추천 상세 확장 3종(`relatedRecentCares` 등) | 2절 | `recommendations.service.ts` — `listRecentCareRecords()` + 키워드 기반 태그 매핑(`KEYWORD_GROUPS`, interestGoals 매칭과 공유) | 불필요 |

마이그레이션 003은 이미 Supabase 프로젝트에 적용됐고(001·002 위에 누적), 데모 데이터도 `npm run seed`로 재시드해 새 필드가 채워진 상태를 직접 조회로 검증했다.

### v0.6 신규 항목 — 가상 EMR 기반 회원가입, 이후 인증코드 제거·클리닉 로그인으로 확장

실제 클리닉처럼 "환자가 앱에 가입하기 전에 의료진이 먼저 시술 이력을 입력해둔다"는 흐름을 반영해, 회원가입 방식을 이메일/비밀번호 자유 가입에서 환자번호+인증코드 기반 가입으로 교체했다(006). 이후 같은 v0.6 범위 안에서 인증코드 발급 절차 자체를 없애고 **환자번호+이름+생년월일 대조**로 더 단순화했다(010). `server_admin` 쪽은 클리닉별 관리자 로그인(무인증 데모 결정을 뒤집음)과 브랜드별 데이터 격리가 추가됐지만, 이 문서는 `server/`(고객용) 범위만 다루므로 상세는 `server_admin/README.md` 참고. 엔드투엔드 실측 테스트(환자 등록→시술기록/이용권 추가→가입 신원대조→데이터 이관 확인→재가입 차단 확인, 비밀번호 재설정 실제 메일 수신까지)를 통과했다.

| 항목 | 문서(api-spec.md) 위치 | 구현 위치 | 마이그레이션 |
|---|---|---|---|
| `POST /auth/signup` 시그니처 | 1절 | `auth.service.ts`의 `signup()` — 현재 `{patientNo,name,birthDate,email,password,interestGoals}`(2026-08-13엔 `verificationCode` 방식이었으나 010에서 대체) | `006_add_admin_emr_staging_tables.sql`(신설) → `010_signup_identity_check_and_patient_notes.sql`(현재 방식으로 대체) |
| `PATIENT_NOT_FOUND`/`PATIENT_ALREADY_CLAIMED`/`PATIENT_IDENTITY_MISMATCH` | 공통 에러 코드 | `lib/errors.ts` — `phoneAlreadyExists` 제거, 3종 추가(`invalidOrExpiredVerificationCode`는 010에서 함께 제거) | 불필요 |
| 비밀번호 재설정 숫자코드화 + 검증/변경 단계 분리 | 1절 | `auth.service.ts`의 `verifyPasswordResetCode`(신규)/`confirmPasswordReset` — `verifyOtp(type:"recovery")`로 코드만 먼저 검증해 `resetToken` 발급, `reset-confirm`은 `resetToken`+새 비밀번호만 받음(3절 참고) | 불필요, Supabase 이메일 템플릿 `{{ .Token }}` 수동 설정 필요 |
| `interestGoals` 회원가입 시 저장 | 1절 | `auth.service.ts`의 `signup()` — `profiles.interest_goals`에 즉시 저장 | 불필요(기존 컬럼 재사용) |
| 신규 관리자용 백엔드 `server_admin/` | 문서 범위 밖(별도 README) | 환자 CRUD, 시술기록/이용권 추가·삭제, 클리닉 로그인(JWT), 브랜드별 격리 — `server/`와 동일 3단 컨벤션, 포트 4100 | `007`~`012`(`server_admin/README.md` 참고) |
| 스테이징 테이블 | `db-schema.md` "가상 EMR 스테이징 테이블(006)" 절 | `emr_patients`/`emr_care_records`/`emr_memberships` (`signup_verification_codes`는 010에서 삭제) | `006` 신설 → `007`~`012`에서 컬럼 개편 |

**Windows 개발 환경 참고**: `tsx watch`가 파일 저장 후 재시작할 때 이전 프로세스가 포트를 즉시 놓지 않아 `EADDRINUSE`로 죽는 경우가 관찰됐다. 로컬에서 안정적으로 띄우려면 `npm run build` 후 `node dist/src/server.js`(고정 프로세스) 권장 — 빌드 산출물은 `rootDir: "."` 설정 때문에 `dist/server.js`가 아니라 `dist/src/server.js`이다.

---

## 10. 앞으로 코드를 볼 때 참고할 포인트

- 새 엔드포인트를 추가한다면: `routes/*.routes.ts`(얇은 매핑) → `validators/*.ts`(zod 스키마) →
  `services/*.ts`(실제 로직)의 3단 구조를 그대로 따르는 것이 기존 코드와 일관된다.
- LLM 호출 지점은 코드 전체에서 딱 2곳이다 — `services/aftercare.service.ts`의 `submitQuestion`
  내부(questions)와 `services/recommendations.service.ts`의 `generateRecommendationCopy` 내부
  (recommendation). daily-guide는 `(v0.5)` LLM을 호출하지 않는다(5-1절 참고). 다른 곳에서
  LLM을 호출하는 코드는 없다.
- `lib/riskKeywords.ts`의 두 목록은 전문가 검수 전 초안이므로, 실제 서비스 오픈 전 반드시
  의료진 검토가 필요하다(`.work-log/current.md`의 "다음 할 일" 항목).
