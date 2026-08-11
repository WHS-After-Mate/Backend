# WHS After Mate — API 명세서 (v0.5, MVP)

기준 프로젝트: Manyfast "WHS After Mate" (관리 이력·이용권 조회 / LLM 기반 사후관리 안내·질문 / 다음 관리 추천)
흐름 기준: `api-user-flow.html` 다이어그램과 섹션 순서를 동일하게 맞춤 — 인증/온보딩 → 홈(추천 포함) → 사후관리 Q&A → My Care(캘린더/이력/이용권) → 설정/프로필

v0.5 변경: 최종 프론트 와이어프레임(`WHS After Mate.png`, 15개 화면) 검토 결과 기존 명세에 없던 화면 요소 9건을 반영. 아래 "v0.5에서 추가된 항목" 절 참고 — **서버 코드(`server/src`) 구현, DB 마이그레이션(`server/db/migrations/003_v05_wireframe_features.sql`) 적용, 데모 데이터 재시드까지 전부 완료되어 실제 Supabase 프로젝트에 반영된 상태다.**

범위:
- 로그인은 **실제 계정** 기반 (이메일/비밀번호, access/refresh 토큰)
- 관리 이력·이용권은 MVP 특성상 시드(가상) 데이터 조회 중심, 실제 예약·결제·매장 시스템 연동 제외
- 사후관리 안내(일차별 주의사항)와 Q&A 답변은 **LLM 기반**으로 생성(실제 Anthropic Claude API를 호출해 응답을 만들며, 하드코딩된 템플릿이 아니다), 최근 관리·경과일·검수 가이드를 컨텍스트로 사용

- Base URL: `/api/v1`
- 인증: `Authorization: Bearer {accessToken}` (모든 엔드포인트 공통, 이후 절 생략)
- 포맷: `application/json`, 날짜는 `YYYY-MM-DD`, 일시는 ISO 8601(`YYYY-MM-DDTHH:mm:ssZ`)
- 공통 에러 형식:
```json
{ "error": { "code": "STRING_CODE", "message": "사용자에게 보여줄 메시지" } }
```

---

## 엔드포인트 전체 요약 (구현 파일 매핑)

각 API가 실제로 어느 라우트 파일에 구현돼 있는지 정리한 표. 모든 파일은 `server/src/routes/` 아래에 있다 (예: `auth.routes.ts` = `server/src/routes/auth.routes.ts`). 실제 라우팅은 `app.ts`(`/api/v1`) → `routes/index.ts`(예: `/auth`) → 아래 표의 파일(엔드포인트별 나머지 경로) 순으로 3단계에 걸쳐 조립된다 — 자세한 흐름은 `server-code-guide.md` 2절 참고.

| Method | Path | 구현 파일 |
|---|---|---|
| POST | `/auth/signup` | `auth.routes.ts` |
| POST | `/auth/login` | `auth.routes.ts` |
| POST | `/auth/refresh` | `auth.routes.ts` |
| POST | `/auth/logout` | `auth.routes.ts` |
| POST | `/auth/password/reset-request` | `auth.routes.ts` *(v0.5)* |
| POST | `/auth/password/reset-confirm` | `auth.routes.ts` *(v0.5)* |
| GET | `/home/summary` | `home.routes.ts` |
| GET | `/recommendations/next-care` | `recommendations.routes.ts` |
| GET | `/recommendations/next-care/{recommendationId}` | `recommendations.routes.ts` |
| GET | `/aftercare/daily-guide` | `aftercare.routes.ts` |
| GET | `/aftercare/question-categories` | `aftercare.routes.ts` |
| POST | `/aftercare/questions` | `aftercare.routes.ts` |
| GET | `/aftercare/questions` | `aftercare.routes.ts` |
| GET | `/care-records/calendar` | `careRecords.routes.ts` |
| GET | `/care-records` | `careRecords.routes.ts` |
| GET | `/care-records/{careRecordId}` | `careRecords.routes.ts` |
| GET | `/memberships` | `memberships.routes.ts` |
| GET | `/memberships/{membershipId}` | `memberships.routes.ts` |
| GET | `/profile` | `profile.routes.ts` |
| PATCH | `/profile` | `profile.routes.ts` |
| POST | `/profile/password` | `profile.routes.ts` *(v0.5)* |
| PUT | `/profile/interests` | `profile.routes.ts` |
| GET | `/notifications/settings` | `notifications.routes.ts` |
| PATCH | `/notifications/settings` | `notifications.routes.ts` |
| POST | `/notifications/device-token` | `notifications.routes.ts` |
| DELETE | `/notifications/device-token` | `notifications.routes.ts` |

---

## 1. 인증 / 온보딩

회원가입은 **이메일/비밀번호 가입**으로 진행한다(전화번호 SMS 인증은 미구현으로 제외 — `server/README.md` TODO 참고). 로그인은 이메일/비밀번호만 사용한다.

### POST /auth/signup
이메일/비밀번호 회원가입.

**Request**
```json
{
  "email": "user@example.com",
  "password": "string (8자 이상)",
  "name": "홍길동",
  "phone": "01012345678",
  "birthDate": "1995-03-14"
}
```
**Response 200**: `POST /auth/login`과 동일 스키마 (accessToken, refreshToken, expiresIn, user)
`409 EMAIL_ALREADY_EXISTS`
`409 PHONE_ALREADY_EXISTS`: 이미 가입된 전화번호

### POST /auth/login
실제 계정 로그인 (이메일/비밀번호).

**Request**
```json
{ "email": "user@example.com", "password": "string" }
```

**Response 200**
```json
{
  "accessToken": "jwt...",
  "refreshToken": "jwt...",
  "expiresIn": 3600,
  "user": { "id": "U-1001", "name": "홍길동", "role": "customer" }
}
```
`401 INVALID_CREDENTIALS`

### POST /auth/refresh
accessToken 재발급.

**Request**
```json
{ "refreshToken": "jwt..." }
```
**Response 200**: `{ "accessToken": "jwt...", "expiresIn": 3600 }`
`401 INVALID_REFRESH_TOKEN`

### POST /auth/logout
설정 화면의 로그아웃 액션. 서버 측 refreshToken 무효화.

**Response 204**

### POST /auth/password/reset-request `(v0.5)`
로그인 화면의 "비밀번호를 잊으셨나요?" — 이메일 입력 후 재설정 링크 발송.

**Request**
```json
{ "email": "user@example.com" }
```
**Response 204** — 가입 여부와 무관하게 항상 204 (계정 존재 여부를 노출하지 않기 위한 의도적 설계)
- Supabase Auth `resetPasswordForEmail(email, { redirectTo: <앱 딥링크> })` 위임 예정. 이메일 링크가 앱을 열면 `recoveryToken`을 클라이언트가 추출해 아래 confirm 엔드포인트로 전달

### POST /auth/password/reset-confirm `(v0.5)`
재설정 링크로 열린 화면에서 새 비밀번호 설정.

**Request**
```json
{ "recoveryToken": "string", "newPassword": "string" }
```
**Response 204**
`400 INVALID_OR_EXPIRED_RESET_TOKEN`
- `recoveryToken`은 Supabase 기본 "Reset Password" 메일 템플릿이 리다이렉트 시 URL 해시(`#access_token=...&type=recovery`)로 실어 보내는 **access_token 값**이다(실사용 링크로 실측 확인, `auth.service.ts`의 `confirmPasswordReset` 참고). `token_hash`가 아니므로 이메일 템플릿을 커스텀하지 않는 한 클라이언트는 해시 프래그먼트에서 `access_token` 파라미터를 추출해 그대로 전달하면 된다.

---

## 2. 홈 (R-USXPEM, R-QGENNK)

홈 진입 시 1회 호출. 최근 관리 요약, 경과일 주의사항 카드, 이용권 요약, 다음 관리 추천을 한 번에 반환한다.

홈에는 **사후관리 카드**(클릭 → 3절 AI 사후관리 가이드로 이동)와 **"AI에게 물어보기" 버튼**(클릭 → 3절 챗봇으로 바로 이동)이 있다.

### GET /home/summary

**Response 200**
```json
{
  "latestCare": {
    "careRecordId": "C-2001",
    "careName": "브라이트닝 필링",
    "careDate": "2026-07-25",
    "daysElapsed": 5,
    "partOfBody": "얼굴"
  },
  "aftercareCard": {
    "guideId": "G-31",
    "elapsedRange": "3-7",
    "cautions": ["직사광선 노출 자제", "각질 제거 제품 사용 금지"],
    "nextCheckDate": "2026-08-01",
    "generatedAt": "2026-07-30T00:05:00Z"
  },
  "membershipSummary": {
    "totalMemberships": 2,
    "nearestExpiry": { "membershipId": "M-501", "expiresAt": "2026-09-30", "remainingCount": 3 }
  },
  "recommendation": {
    "recommendationId": "R-9001",
    "careName": "수분 재생 관리",
    "reasons": ["최근 관리 후 4주 경과", "관심 목표: 수분 개선"]
  }
}
```
- `latestCare`가 없는 신규 고객: `null` (프론트는 온보딩 카드 표시)
- `aftercareCard.generatedAt`: 해당 일자 LLM 생성/갱신 시각 (3절 참고)
- `403 NO_ACTIVE_CUSTOMER_PROFILE`: 연결된 고객 프로필 없음

### GET /recommendations/next-care
규칙 기반 추천 후보 1개 + 이유. 홈의 추천 카드.

**Response 200**
```json
{
  "recommendationId": "R-9001",
  "careName": "수분 재생 관리",
  "reasons": [
    "최근 관리(브라이트닝 필링) 후 4주 경과",
    "보유 이용권 내 이용 가능",
    "관심 목표: 수분 개선"
  ],
  "basis": ["latestCare", "membership", "goal"],
  "disclaimer": "의료적 진단이 아니며 최종 관리는 전문가 상담 후 결정하세요."
}
```
`204 NO_RECOMMENDATION_AVAILABLE`: 추천 근거 부족(관리 이력 없음 등)
- 참고: 홈 화면은 이 엔드포인트를 직접 호출하지 않고 `GET /home/summary`의 `recommendation` 필드를 재사용한다. 단독 조회가 필요한 경우(새로고침, 홈 API 실패 시 폴백)를 위해 별도로 제공한다.

### GET /recommendations/next-care/{recommendationId}
추천 카드 → 추천 상세 보기(AI 관리 추천 화면).

**Response 200**: `GET /recommendations/next-care` 응답과 동일 스키마 + 아래 필드 추가

```json
{
  "detailDescription": "브라이트닝 부스터 케어는 색소침착 개선에 특화된 관리로...",
  "relatedRecentCares": [
    { "careRecordId": "C-2001", "careName": "올쎄라 리프팅", "daysElapsed": 21 },
    { "careRecordId": "C-1988", "careName": "인모드", "daysElapsed": 44 }
  ],
  "popularWithSimilarCustomers": ["리프트 관리", "색소 관리", "회복탄력 관리"],
  "clinicContacts": [
    { "brand": "앰레드", "label": "앰레드 클리닉" },
    { "brand": "다나", "label": "다나 의원" },
    { "brand": "윔", "label": "윔 센터" }
  ]
}
```
- `relatedRecentCares` `(v0.5)`: "최근 관리와 함께 확인해보세요" 섹션. `latestCare` 1건이 아니라 최근 관리 이력 여러 건 + 각각의 경과일. `care_records`에서 최신순 N건 조회로 계산 (신규 테이블 불필요)
- `popularWithSimilarCustomers` `(v0.5)`: "비슷한 고객이 자주 찾는 관리" 태그. MVP에서는 추천 대상 `care_type`별로 사전 정의된 연관 태그 목록을 반환하는 규칙 기반 매핑(실제 유사도 계산 아님)
- `clinicContacts` `(v0.5)`: "담당" chips. 사용자의 최근 관리 이력에 등장한 `brand` distinct 목록에서 파생 (신규 테이블 불필요)

---

## 3. 사후관리 안내 및 Q&A — LLM 기반 (R-USXPEM → F-GBZTGO, F-ULCIXA)

일차별 주의사항과 Q&A 답변은 모두 LLM이 생성한다(여기서 "LLM"은 실제로 서버가 Anthropic Claude API를 호출해 받는 응답을 뜻하며, 미리 정해둔 문구를 보여주는 것이 아니다 — 구현은 `server/src/services/llm/client.ts`, `callStructuredLlm()` 참고). 컨텍스트로 최근 관리명·관리일·경과일·검수된 관리 가이드(RAG 소스)를 사용하며, 의료적 진단·처방은 생성하지 않도록 시스템 프롬프트에서 제한한다.

**진입 경로**: 홈의 "사후관리 카드" 클릭 시 `careRecordId`가 지정된 채로 AI 사후관리 가이드에 진입한다. 챗봇은 ① 가이드 페이지의 "더 궁금한 점?" ② 홈의 "AI에게 물어보기" 버튼, 두 경로로 진입할 수 있다. My Care 관리 상세 화면의 "AI 사후관리 가이드" 버튼도 동일한 가이드 화면으로 연결된다(4절 참고).

### GET /aftercare/daily-guide
경과일에 맞는 일차별 주의사항. 고객당 "관리 건 + 오늘 날짜" 조합 기준 **1일 1회 LLM 호출**로 생성 후 자정까지 캐시한다.

**Query**:
- `careRecordId` (optional. 생략 시 최근 관리 기준. 홈/My Care 상세에서 진입 시 전달됨)
- `elapsedDay` (optional, `v0.5`. AI 사후관리 가이드 화면의 1일차/3일차/5일차/7일차/10일차 탭 선택값. 생략 시 오늘 실제 경과일 기준)

**Response 200**
```json
{
  "guideId": "G-31",
  "careRecordId": "C-2001",
  "careName": "브라이트닝 필링",
  "daysElapsed": 5,
  "elapsedRange": "3-7",
  "isToday": true,
  "mustAvoid": ["각질 제거 제품 사용", "고강도 유산소 운동"],
  "basicCare": ["미온수 세안", "저자극 보습"],
  "nextCheckDate": "2026-08-01",
  "generatedAt": "2026-07-30T00:05:00Z",
  "generatedBy": "llm",
  "cacheExpiresAt": "2026-07-31T00:00:00Z"
}
```
- `isToday` `(v0.5 신규)`: `elapsedDay`가 실제 오늘 경과일과 같거나 생략된 경우 `true`. 이 경우에만 기존 로직대로 LLM 개인화 생성 + 캐시를 사용
- `elapsedDay`로 다른 탭(과거/미래 경과일)을 조회하면 개인화 LLM 호출 없이 `reference_guides`(검수된 가이드 원문)를 그대로 반환한다 — `generatedBy: "reference_guide"`. 가상의 경과일에 대해 매번 LLM을 호출하는 비용·안전 부담을 피하기 위함
`404 GUIDE_NOT_AVAILABLE`: 지원하지 않는 관리 유형/경과일 구간
`503 GUIDE_GENERATION_FAILED`: LLM 생성 실패 시 재시도 안내(폴백: 검수된 기본 가이드 문구로 대체)

### GET /aftercare/question-categories
지원 질문 카테고리 목록 (고정값 조회용). 챗봇 진입 시 최초 호출.

**Response 200**
```json
{ "categories": ["세안·샤워", "화장·렌즈", "운동·사우나", "음주·흡연", "화장품·성분", "증상"] }
```

### POST /aftercare/questions
챗봇 질문 등록 및 LLM 답변 조회(동기 응답). 최근 관리·경과일·검수 가이드를 컨텍스트로 답변을 생성한다.

**Request**
```json
{ "careRecordId": "C-2001", "category": "운동·사우나", "question": "필링 후 사우나 언제부터 가능한가요?" }
```

**Response 200 — 정상 답변**
```json
{
  "questionId": "Q-7001",
  "status": "answered",
  "answer": "브라이트닝 필링 후 경과일 5일차 기준, 자극에 민감한 상태이므로 사우나는 관리 후 7일 이후를 권장합니다.",
  "answeredBy": "llm",
  "basedOn": { "careRecordId": "C-2001", "daysElapsed": 5, "guideId": "G-31" }
}
```

**Response 200 — 범위 밖/위험 신호**
```json
{
  "questionId": "Q-7002",
  "status": "out_of_scope",
  "message": "해당 질문은 앱에서 제공하는 정보 범위를 벗어나 전문가 상담이 필요합니다.",
  "expertContactRequired": true
}
```
- `status`: `answered` | `out_of_scope` | `expert_required`(통증·출혈 등 위험 신호는 LLM 호출 전 규칙 기반으로 우선 차단)
- `422 UNSUPPORTED_CATEGORY`
- `503 ANSWER_GENERATION_FAILED`

### GET /aftercare/questions
내 질문 이력 조회 (최신순).

**Response 200**: `POST /aftercare/questions` 응답 항목의 배열 + `createdAt`
- 참고: 현재 유저플로우에는 이 화면으로 가는 명시적 진입점이 없다 (향후 챗봇 내 "지난 질문 보기" 등으로 연결 예정).

---

## 4. My Care — 관리 이력 및 이용권 (R-DCDOJF)

My Care는 캘린더 / 이력 / 이용권 3개 진입점을 가진다. 캘린더에서 날짜를 클릭하거나 이력 목록에서 항목을 클릭하거나 동일한 관리 상세 화면(`GET /care-records/{id}`)으로 연결된다.

### GET /care-records/calendar
캘린더 화면에 월별 시술 유무·건수 마커를 표시하기 위한 요약 조회.

**Query**: `month`(`YYYY-MM`, required)

**Response 200**
```json
{
  "month": "2026-07",
  "dates": [
    { "date": "2026-07-25", "count": 1 }
  ]
}
```
- 특정 날짜 클릭 후 "시술 내역" 목록은 별도 엔드포인트 없이 `GET /care-records?dateFrom={date}&dateTo={date}` 재사용

### GET /care-records
관리 이력 목록 (최신순). 이력 탭의 전체 목록 및 캘린더에서 날짜 클릭 시 "시술 내역" 조회에 공통으로 사용.

**Query**: `page`(default 1), `size`(default 20), `dateFrom`, `dateTo`, `partOfBody`, `brand` (모두 optional)
- **이력 필터 적용**: 이력 목록 화면에서 조건을 걸어 좁혀보는 기능. 새 엔드포인트가 아니라 이 API를 `dateFrom`/`dateTo`/`partOfBody`/`brand` 쿼리와 함께 다시 호출하는 것
- 캘린더는 `dateFrom=dateTo=클릭한 날짜`로 호출

**Response 200**
```json
{
  "items": [
    {
      "careRecordId": "C-2001",
      "careName": "브라이트닝 필링",
      "careDate": "2026-07-25",
      "partOfBody": "얼굴",
      "brand": "AAC 청담",
      "store": "AAC 청담점",
      "practitioner": "김OO 원장",
      "status": "completed"
    }
  ],
  "page": 1, "size": 20, "totalCount": 12
}
```
- `status` `(v0.5)`: 이력 목록 화면의 "완료" 등 상태 칩. 현재 값 후보는 `completed` 하나뿐이나(EMR 동기화 데이터가 이미 끝난 시술 위주) 스키마상 문자열로 열어둠

### GET /care-records/{careRecordId}
관리 상세 + 기본 사후관리 안내. 캘린더 경로와 이력 경로 모두 동일한 이 화면으로 연결된다. 상세 화면의 "AI 사후관리 가이드" 버튼은 `GET /aftercare/daily-guide?careRecordId={careRecordId}`로 이동한다(3절 참고).

**Response 200**
```json
{
  "careRecordId": "C-2001",
  "careName": "브라이트닝 필링",
  "careDate": "2026-07-25",
  "partOfBody": "얼굴",
  "brand": "AAC 청담",
  "store": "AAC 청담점",
  "practitioner": "김OO 원장",
  "status": "completed",
  "daysElapsed": 19,
  "session": { "number": 2, "total": 3 },
  "membership": { "membershipId": "M-501", "productName": "울쎄라 3회 이용권" },
  "basicAftercareGuide": ["당일 세안은 미온수로", "일주일간 자외선 차단제 필수"]
}
```
- `daysElapsed` `(v0.5)`: 관리 상세 화면의 "결과일: 관리 후 N일차". `careDate`로부터 서버가 계산(기존 `daysElapsedSince` 유틸 재사용, 신규 로직 아님)
- `session` `(v0.5)`: "관리 회차: 2/3회차". 이 시술 건이 연결된 이용권 안에서 몇 번째 사용인지
- `membership` `(v0.5)`: 이 시술이 차감한 이용권 참조. `care_records.membership_id` FK로 연결(db-schema.md 참고)
`404 CARE_RECORD_NOT_FOUND`

### GET /memberships
보유 이용권 목록.

**Response 200**
```json
{
  "items": [
    {
      "membershipId": "M-501",
      "productName": "바디 관리 10회권",
      "totalCount": 10,
      "usedCount": 7,
      "remainingCount": 3,
      "expiresAt": "2026-09-30",
      "lastUsedAt": "2026-07-20",
      "availableCareNames": ["바디 슬리밍 관리", "림프 순환 관리"],
      "usageHistory": [
        { "sessionNumber": 1, "usedAt": "2026-01-01" },
        { "sessionNumber": 2, "usedAt": "2026-03-01" }
      ]
    }
  ]
}
```
- `usageHistory` `(v0.5)`: 이용권 화면의 "1회차 2026.01.01(일)", "2회차 2026.03.01(일)" — 회차별 사용일자 목록. `usedCount`처럼 집계값이 아니라 개별 사용 이력이라 신규 테이블(`membership_usages`) 필요 (db-schema.md 참고)

### GET /memberships/{membershipId}
이용권 상세. 응답 스키마는 목록 항목과 동일(`usageHistory` 포함).
`404 MEMBERSHIP_NOT_FOUND`

---

## 5. 설정 / 프로필

### GET /profile
프로필 조회 (이름, 생년월일, 이메일, 휴대폰번호, 관심 목표, 알림 설정 요약).

**Response 200**
```json
{
  "userId": "U-1001",
  "name": "홍길동",
  "birthDate": "2000-01-04",
  "email": "user@example.com",
  "phone": "01011112222",
  "interestGoals": ["수분 개선", "탄력 관리"]
}
```
- `birthDate` `(v0.5)`: 내 정보 화면의 "생년월일"
- `phone` `(v0.5)`: 내 정보 화면의 "휴대폰 번호". 회원가입 시 입력한 번호를 그대로 조회 전용으로 노출(변경은 범위 밖 — 별도 논의 필요)

### PATCH /profile
이름, 생년월일 등 기본 정보 수정 (`email`/`phone`은 읽기 전용 — 각각 계정 식별자·가입 시 입력값이라 이 엔드포인트로 변경 불가).
- 참고: 유저플로우에는 "관심 목표 설정" 액션만 명시되어 있고 기본 정보 수정 액션 노드는 아직 없다 (프로필 화면에 편집 버튼 추가 예정).

### POST /profile/password `(v0.5)`
내 정보 화면의 비밀번호 변경(이전 비밀번호 확인 후 저장).

**Request**
```json
{ "currentPassword": "string", "newPassword": "string" }
```
**Response 204**
`401 INVALID_CURRENT_PASSWORD`

### PUT /profile/interests
관심 목표 설정. 다음 관리 추천(`basis: goal`)의 입력값으로 사용된다.

**Request**
```json
{ "goals": ["수분 개선", "탄력 관리"] }
```
**Response 200**: 저장된 `interestGoals` 배열 반환

### GET /notifications/settings
알림 설정 조회.

**Response 200**
```json
{ "pushEnabled": true, "aftercareReminder": true, "membershipExpiryAlert": true, "marketingAlert": true }
```
- `marketingAlert` `(v0.5)`: 설정 화면의 "마케팅 알림" 토글

### PATCH /notifications/settings
알림 온/오프 설정.

**Request**: 위 응답과 동일한 필드 중 변경할 값만 전달

### POST /notifications/device-token
Android 클라이언트가 FCM(Firebase Cloud Messaging) 토큰을 발급받은 뒤 서버에 등록. 앱 시작 시 또는 토큰 갱신(`onNewToken`) 시 호출.

**Request**
```json
{ "fcmToken": "d3adbeef...", "platform": "android" }
```
**Response 204**

### DELETE /notifications/device-token
로그아웃 등으로 더 이상 해당 기기에 푸시를 보내지 않아야 할 때 토큰 해제.

**Request**
```json
{ "fcmToken": "d3adbeef..." }
```
**Response 204**

---

## 데이터 모델 요약

| 모델 | 핵심 필드 |
|---|---|
| User | id, name, email, phone, role(customer/expert/admin) |
| CareRecord | id, careName, careDate, partOfBody, brand, store, practitioner, basicAftercareGuide, **status, daysElapsed, session{number,total}, membership{id,productName}** *(굵은 필드 v0.5)* |
| Membership | id, productName, totalCount, usedCount, remainingCount, expiresAt, lastUsedAt, availableCareNames, **usageHistory[]{sessionNumber,usedAt}** *(v0.5)* |
| AftercareGuide | id, careType, elapsedRangeStart, elapsedRangeEnd, mustAvoid[], basicCare[], generatedAt, generatedBy, cacheExpiresAt, **isToday** *(v0.5)* |
| Question | id, careRecordId, category, question, status, answer, answeredBy, expertContactRequired, createdAt |
| Recommendation | id, careName, reasons[], basis[], disclaimer, detailDescription, **relatedRecentCares[], popularWithSimilarCustomers[], clinicContacts[]** *(v0.5)* |
| Profile | userId, name, email, interestGoals[], **birthDate, phone** *(v0.5)* |
| NotificationSettings | pushEnabled, aftercareReminder, membershipExpiryAlert, **marketingAlert** *(v0.5)* |

## 공통 에러 코드

| code | 상황 |
|---|---|
| `UNAUTHORIZED` | 토큰 없음/만료 |
| `INVALID_REFRESH_TOKEN` | refreshToken 만료/무효 |
| `EMAIL_ALREADY_EXISTS` | 이미 가입된 이메일 |
| `PHONE_ALREADY_EXISTS` | 이미 가입된 전화번호 |
| `NO_ACTIVE_CUSTOMER_PROFILE` | 연결된 고객 프로필 없음 |
| `CARE_RECORD_NOT_FOUND` | 존재하지 않는 관리 이력 |
| `MEMBERSHIP_NOT_FOUND` | 존재하지 않는 이용권 |
| `GUIDE_NOT_AVAILABLE` | 미지원 관리 유형/경과일 |
| `GUIDE_GENERATION_FAILED` | LLM 일차별 가이드 생성 실패 |
| `ANSWER_GENERATION_FAILED` | LLM Q&A 답변 생성 실패 |
| `UNSUPPORTED_CATEGORY` | 미지원 질문 카테고리 |
| `INVALID_OR_EXPIRED_RESET_TOKEN` | 비밀번호 재설정 토큰 무효/만료 *(v0.5 신규)* |
| `INVALID_CURRENT_PASSWORD` | 비밀번호 변경 시 현재 비밀번호 불일치 *(v0.5 신규)* |

## 미확정 사항 (기획팀 확인 필요)
- refreshToken 만료 기간 및 재로그인 정책 (현재 Supabase Auth 기본값 사용)
- 알림 설정 세부 항목이 push/aftercareReminder/membershipExpiryAlert 3종으로 충분한지
- FCM 실제 발송 트리거(아침 리마인더 배치 등) 스케줄 — 서버는 발송 함수만 준비된 상태

## 구현 시 확정된 사항 (server/README.md 참고)
- LLM(daily-guide) 생성 실패 시: 문서상 503이었으나 실제로는 검수된 가이드(`reference_guides`) 원문으로 자동 폴백해 200 응답 (`generatedBy: "reference_guide"`). LLM 없이도 항상 최소 안전한 답을 준다
- 위 표 5절에 Android FCM 디바이스 토큰 등록/해제 엔드포인트 신규 추가 (`POST`/`DELETE /notifications/device-token`)

## v0.5에서 추가된 항목 (와이어프레임 검토 반영, 구현·마이그레이션·시드 전부 완료)

최종 프론트 와이어프레임(`WHS After Mate.png`, 15개 화면)을 기존 명세(v0.4)와 대조해 발견한 9건. **서버 코드 구현, `server/db/migrations/003_v05_wireframe_features.sql` Supabase 적용, `npm run seed` 재시드까지 전부 완료돼 실제 DB에서 동작 확인됐다.**

| # | 항목 | 화면(와이어프레임) | 엔드포인트/필드 | 구현 위치 |
|---|---|---|---|---|
| 1 | 비밀번호 찾기 | 05. 비밀번호를 잊으셨나요? | `POST /auth/password/reset-request`, `POST /auth/password/reset-confirm` | `auth.routes.ts`/`auth.service.ts` |
| 2 | 비밀번호 변경 | 14. 내 정보 | `POST /profile/password` | `profile.routes.ts`/`profile.service.ts` |
| 3 | 마케팅 알림 토글 | 13. 설정 | `NotificationSettings.marketingAlert` | `notifications.service.ts` |
| 4 | 프로필 확장 | 14. 내 정보 | `Profile.birthDate`, `Profile.phone` | `profile.service.ts` |
| 5 | 이용권 회차별 사용이력 | 10. My Care·이용권 | `Membership.usageHistory[]` (신규 테이블 `membership_usages`) | `memberships.service.ts` |
| 6 | 관리 상세 확장 | 11. 관리 상세 | `CareRecord.status`, `daysElapsed`, `session`, `membership` (신규 컬럼) | `careRecords.service.ts` |
| 7 | 일차별 가이드 탭 조회 | 07. AI 사후관리 가이드 | `GET /aftercare/daily-guide?elapsedDay=` | `aftercare.service.ts` |
| 8 | 추천 상세 확장 | 15. AI 관리 추천 | `relatedRecentCares`, `popularWithSimilarCustomers`, `clinicContacts` | `recommendations.service.ts` |
| 9 | 이력 상태 칩 | 09. My Care·이력 | `CareRecord.status` (6과 동일 필드) | `careRecords.service.ts` |

DB 스키마 변경 상세는 `db-schema.md`의 "v0.3에서 추가된 항목" 절, 유저플로우 변경은 `api-user-flow.html`의 비밀번호 재설정/변경 분기 참고.
