# WHS After Mate — Server

Android(Android Studio) 클라이언트가 호출하는 REST API 서버. Node.js + Express + TypeScript, DB/인증은 Supabase, LLM은 Anthropic Claude, 푸시는 Firebase Cloud Messaging(FCM)을 사용한다.

문서 기준: `../docs/api-spec.md` v0.4, `../docs/db-schema.md` v0.2, `../docs/llm-prompt-design.md` v0.1

## 준비

1. Supabase 프로젝트 생성 (https://supabase.com) 후 Settings > API에서 URL/anon key/service role key 확인
2. Anthropic API 키 발급 (https://console.anthropic.com)
3. (선택, 나중에 해도 됨) Firebase 프로젝트 생성 → 서비스 계정 JSON 발급 (FCM 푸시 발송용)

```bash
cp .env.example .env
# .env에 SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY, ANTHROPIC_API_KEY, APP_TOKEN_SECRET 채우기
npm install
```

## DB 마이그레이션 적용

`db/migrations/*.sql`을 Supabase SQL Editor에 순서대로(001 → 002) 붙여넣어 실행한다.
(CLI를 쓴다면 `supabase db push` 또는 `psql`로 동일 파일 실행)

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
  lib/         # 에러 정의, 위험신호 키워드, 카테고리, 서명 토큰, OTP, SMS
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
- **추천 상세조회 라우팅**: `recommendationId`는 저장되지 않고 `userId` 기반 결정론적 해시로 매 요청 생성 — `GET /recommendations/next-care/{id}`는 재계산 후 id가 일치할 때만 상세를 반환
