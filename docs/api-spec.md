# WHS After Mate — API 명세서 (v0.4, MVP)

기준 프로젝트: Manyfast "WHS After Mate" (관리 이력·이용권 조회 / LLM 기반 사후관리 안내·질문 / 다음 관리 추천)
흐름 기준: `api-user-flow.html` 다이어그램과 섹션 순서를 동일하게 맞춤 — 인증/온보딩 → 홈(추천 포함) → 사후관리 Q&A → My Care(캘린더/이력/이용권) → 설정/프로필

범위:
- 로그인은 **실제 계정** 기반 (이메일/비밀번호, access/refresh 토큰)
- 관리 이력·이용권은 MVP 특성상 시드(가상) 데이터 조회 중심, 실제 예약·결제·매장 시스템 연동 제외
- 사후관리 안내(일차별 주의사항)와 Q&A 답변은 **LLM 기반**으로 생성, 최근 관리·경과일·검수 가이드를 컨텍스트로 사용

- Base URL: `/api/v1`
- 인증: `Authorization: Bearer {accessToken}` (모든 엔드포인트 공통, 이후 절 생략)
- 포맷: `application/json`, 날짜는 `YYYY-MM-DD`, 일시는 ISO 8601(`YYYY-MM-DDTHH:mm:ssZ`)
- 공통 에러 형식:
```json
{ "error": { "code": "STRING_CODE", "message": "사용자에게 보여줄 메시지" } }
```

---

## 1. 인증 / 온보딩

회원가입은 **전화번호 SMS 인증 → 이메일/비밀번호 가입** 순서로 진행한다. 로그인은 이후 이메일/비밀번호만 사용한다.

### POST /auth/signup/verify-phone/request
회원가입 시 본인확인용 SMS 인증코드 발송.

**Request**
```json
{ "phone": "01012345678" }
```
**Response 200**: `{ "verificationId": "V-8841", "expiresIn": 180 }`
`400 INVALID_PHONE_FORMAT`
`429 TOO_MANY_REQUESTS`: 재요청 주기 제한(예: 60초)

### POST /auth/signup/verify-phone/confirm
인증코드 확인. 성공 시 짧은 유효기간의 검증 토큰을 발급하며, 이 토큰을 회원가입 요청에 함께 보낸다.

**Request**
```json
{ "verificationId": "V-8841", "code": "482913" }
```
**Response 200**: `{ "phoneVerifiedToken": "pvt_xxx", "expiresIn": 600 }`
`400 INVALID_CODE`
`410 CODE_EXPIRED`
`429 TOO_MANY_ATTEMPTS`: 코드 오입력 횟수 초과

### POST /auth/signup
이메일/비밀번호 회원가입. 전화번호는 위 단계에서 인증된 상태여야 한다.

**Request**
```json
{
  "email": "user@example.com",
  "password": "string",
  "name": "홍길동",
  "phone": "01012345678",
  "phoneVerifiedToken": "pvt_xxx"
}
```
**Response 200**: `POST /auth/login`과 동일 스키마 (accessToken, refreshToken, expiresIn, user)
`409 EMAIL_ALREADY_EXISTS`
`400 PHONE_NOT_VERIFIED`: 토큰 누락/만료 또는 phone 불일치

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
추천 카드 → 추천 상세 보기.

**Response 200**: `GET /recommendations/next-care` 응답과 동일 스키마 + 상세 설명 문단(`detailDescription`)

---

## 3. 사후관리 안내 및 Q&A — LLM 기반 (R-USXPEM → F-GBZTGO, F-ULCIXA)

일차별 주의사항과 Q&A 답변은 모두 LLM이 생성한다. 컨텍스트로 최근 관리명·관리일·경과일·검수된 관리 가이드(RAG 소스)를 사용하며, 의료적 진단·처방은 생성하지 않도록 시스템 프롬프트에서 제한한다.

**진입 경로**: 홈의 "사후관리 카드" 클릭 시 `careRecordId`가 지정된 채로 AI 사후관리 가이드에 진입한다. 챗봇은 ① 가이드 페이지의 "더 궁금한 점?" ② 홈의 "AI에게 물어보기" 버튼, 두 경로로 진입할 수 있다. My Care 관리 상세 화면의 "AI 사후관리 가이드" 버튼도 동일한 가이드 화면으로 연결된다(4절 참고).

### GET /aftercare/daily-guide
경과일에 맞는 일차별 주의사항. 고객당 "관리 건 + 오늘 날짜" 조합 기준 **1일 1회 LLM 호출**로 생성 후 자정까지 캐시한다.

**Query**: `careRecordId` (optional. 생략 시 최근 관리 기준. 홈/My Care 상세에서 진입 시 전달됨)

**Response 200**
```json
{
  "guideId": "G-31",
  "careRecordId": "C-2001",
  "careName": "브라이트닝 필링",
  "daysElapsed": 5,
  "elapsedRange": "3-7",
  "mustAvoid": ["각질 제거 제품 사용", "고강도 유산소 운동"],
  "basicCare": ["미온수 세안", "저자극 보습"],
  "nextCheckDate": "2026-08-01",
  "generatedAt": "2026-07-30T00:05:00Z",
  "generatedBy": "llm",
  "cacheExpiresAt": "2026-07-31T00:00:00Z"
}
```
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
      "practitioner": "김OO 원장"
    }
  ],
  "page": 1, "size": 20, "totalCount": 12
}
```

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
  "basicAftercareGuide": ["당일 세안은 미온수로", "일주일간 자외선 차단제 필수"]
}
```
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
      "availableCareNames": ["바디 슬리밍 관리", "림프 순환 관리"]
    }
  ]
}
```

### GET /memberships/{membershipId}
이용권 상세. 응답 스키마는 목록 항목과 동일.
`404 MEMBERSHIP_NOT_FOUND`

---

## 5. 설정 / 프로필

### GET /profile
프로필 조회 (이름, 이메일, 관심 목표, 알림 설정 요약).

**Response 200**
```json
{
  "userId": "U-1001",
  "name": "홍길동",
  "email": "user@example.com",
  "interestGoals": ["수분 개선", "탄력 관리"]
}
```

### PATCH /profile
이름 등 기본 정보 수정.
- 참고: 유저플로우에는 "관심 목표 설정" 액션만 명시되어 있고 기본 정보 수정 액션 노드는 아직 없다 (프로필 화면에 편집 버튼 추가 예정).

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
{ "pushEnabled": true, "aftercareReminder": true, "membershipExpiryAlert": true }
```

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
| User | id, name, email, phone, phoneVerifiedAt, role(customer/expert/admin) |
| PhoneVerification | id, phone, codeHash, expiresAt, attempts, verifiedAt |
| CareRecord | id, careName, careDate, partOfBody, brand, store, practitioner, basicAftercareGuide |
| Membership | id, productName, totalCount, usedCount, remainingCount, expiresAt, lastUsedAt, availableCareNames |
| AftercareGuide | id, careType, elapsedRangeStart, elapsedRangeEnd, mustAvoid[], basicCare[], generatedAt, generatedBy, cacheExpiresAt |
| Question | id, careRecordId, category, question, status, answer, answeredBy, expertContactRequired, createdAt |
| Recommendation | id, careName, reasons[], basis[], disclaimer, detailDescription |
| Profile | userId, name, email, interestGoals[] |
| NotificationSettings | pushEnabled, aftercareReminder, membershipExpiryAlert |

## 공통 에러 코드

| code | 상황 |
|---|---|
| `UNAUTHORIZED` | 토큰 없음/만료 |
| `INVALID_REFRESH_TOKEN` | refreshToken 만료/무효 |
| `INVALID_PHONE_FORMAT` | 잘못된 전화번호 형식 |
| `INVALID_CODE` | 인증코드 불일치 |
| `CODE_EXPIRED` | 인증코드 만료 |
| `TOO_MANY_REQUESTS` | 인증코드 재요청 주기 초과 |
| `TOO_MANY_ATTEMPTS` | 인증코드 오입력 횟수 초과 |
| `EMAIL_ALREADY_EXISTS` | 이미 가입된 이메일 |
| `PHONE_NOT_VERIFIED` | 전화번호 인증 미완료/토큰 만료 |
| `NO_ACTIVE_CUSTOMER_PROFILE` | 연결된 고객 프로필 없음 |
| `CARE_RECORD_NOT_FOUND` | 존재하지 않는 관리 이력 |
| `MEMBERSHIP_NOT_FOUND` | 존재하지 않는 이용권 |
| `GUIDE_NOT_AVAILABLE` | 미지원 관리 유형/경과일 |
| `GUIDE_GENERATION_FAILED` | LLM 일차별 가이드 생성 실패 |
| `ANSWER_GENERATION_FAILED` | LLM Q&A 답변 생성 실패 |
| `UNSUPPORTED_CATEGORY` | 미지원 질문 카테고리 |

## 미확정 사항 (기획팀 확인 필요)
- refreshToken 만료 기간 및 재로그인 정책 (현재 Supabase Auth 기본값 사용)
- 알림 설정 세부 항목이 push/aftercareReminder/membershipExpiryAlert 3종으로 충분한지
- FCM 실제 발송 트리거(아침 리마인더 배치 등) 스케줄 — 서버는 발송 함수만 준비된 상태

## 구현 시 확정된 사항 (server/README.md 참고)
- LLM(daily-guide) 생성 실패 시: 문서상 503이었으나 실제로는 검수된 가이드(`reference_guides`) 원문으로 자동 폴백해 200 응답 (`generatedBy: "reference_guide"`). LLM 없이도 항상 최소 안전한 답을 준다
- 위 표 5절에 Android FCM 디바이스 토큰 등록/해제 엔드포인트 신규 추가 (`POST`/`DELETE /notifications/device-token`)
