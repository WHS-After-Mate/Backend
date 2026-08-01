# After School 현재 상태
최종 업데이트: 2026-08-02 02:04

## 프로젝트 개요
WHS After Mate — AAC 웰니스 고객용 관리 이력·이용권 조회, LLM 기반 일차별 사후관리 안내·질문, 다음 관리 추천 MVP(3주 해커톤). 앱 클라이언트는 Android Studio(네이티브 Android)로 개발 예정. 백엔드는 Node.js + Express + TypeScript, DB/인증은 Supabase, LLM은 Anthropic Claude API, 푸시는 FCM으로 확정하고 실제 구현·연동까지 완료한 상태.

## 완료된 작업
- (이전 세션) API 명세서(v0.4)/DB 스키마(v0.2)/LLM 프롬프트 설계(v0.1) 문서화, GitHub 저장소(WHS-After-Mate/Backend) 연결, README 작성
- 백엔드 기술 스택 확정: Node.js+Express+TypeScript / Supabase(Postgres+Auth) / Anthropic Claude API / FCM(Android 푸시)
- `server/` 디렉토리에 백엔드 전체 구현
  - 프로젝트 스캐폴딩: package.json, tsconfig, .env.example, 폴더 구조(config/middleware/lib/services/validators/routes)
  - DB 마이그레이션 SQL 작성(`server/db/migrations/001_init.sql`, `002_reference_guides_and_device_tokens.sql`) — 기존 스키마 8개 테이블 + 신규 `reference_guides`(검수 가이드/RAG 소스, 미확정 사항이었던 저장 위치 확정) + `device_tokens`(FCM) 2개 테이블. `care_records`에 `care_type` 컬럼 추가(검수 가이드 매칭 키)
  - 공통 인프라: Supabase 클라이언트, `requireAuth` 미들웨어(Bearer 토큰 → Supabase Auth 검증), 공통 에러 포맷(`ApiError`/`Errors`), zod 검증
  - 인증 라우트: 전화번호 SMS 인증(자체 서명 토큰 `phoneVerifiedToken`) → 회원가입(Supabase Auth admin.createUser) → 로그인/refresh/logout
  - 홈/추천 라우트: `/home/summary`, `/recommendations/next-care(/{id})` — 추천은 규칙 기반 즉석 계산, recommendationId는 userId 기반 결정론적 해시
  - 사후관리 Q&A + LLM 연동(Claude): `/aftercare/daily-guide`(캐시+생성), `/aftercare/question-categories`, `/aftercare/questions`
    - 구조화 출력: Claude tool-use(`tool_choice: {type:"tool"}`)로 JSON 스키마 강제
    - 규칙 기반 사전 필터: 카테고리 검증, 위험신호 키워드(`riskKeywords.ts`, 전문가 검수 필요한 초안)로 LLM 호출 전 차단
    - 알러지/기저질환/의사코멘트를 항상 컨텍스트로 주입 + `medical_data_access_log` 접근 기록
    - daily-guide LLM 실패 시: `reference_guides` 검수 원문으로 자동 폴백(200, `generatedBy: "reference_guide"`)
    - questions LLM 실패 시: 503 ANSWER_GENERATION_FAILED
  - My Care 라우트: care-records(캘린더/목록/상세), memberships(목록/상세)
  - 설정/프로필 라우트 + Android 전용 신규 엔드포인트 `POST/DELETE /notifications/device-token`(FCM 토큰 등록/해제)
  - 시드 스크립트(`server/db/seed/seed.ts`) — 데모 계정, 관리이력 2건, 이용권 2건, 알러지 정보, 검수 가이드(peeling/laser_toning × 경과구간) 시드
  - 빌드/타입체크 통과 확인, docs 3종(api-spec.md/db-schema.md/llm-prompt-design.md)에 구현 시 확정된 사항 반영, `server/README.md` 작성
- Supabase 프로젝트 실제 생성 및 연동 확인
  - `server/.env` 채움 (SUPABASE_URL 오타 수정: `/rest/v1/` 경로 제거), 001·002 마이그레이션 SQL Editor에서 실행 → 10개 테이블 전부 생성 확인(연결 스크립트로 검증)
  - Anthropic API 키 발급 및 적용
- 실제 서버 기동 후 엔드투엔드 테스트
  - `npm run seed` 성공 (데모 계정 `demo@whsaftermate.app`)
  - 로그인 → `/home/summary` → `/aftercare/daily-guide`(Claude가 알러지·의사코멘트 반영해 실제 생성, 캐시 저장 확인) → `/aftercare/questions` 3가지 케이스 검증(정상 답변/근거없어 out_of_scope/위험신호 expert_required 즉시차단) 모두 정상 동작 확인
  - **버그 발견 및 수정**: Claude가 tool-use 응답 텍스트에 `</answer>`, `</invoke>` 같은 XML 태그 흔적을 남기는 현상 발견 → `server/src/lib/sanitizeLlmText.ts` 신규 작성해 daily-guide/questions 두 곳 모두 LLM 텍스트 정제 후 응답하도록 수정, 재검증 완료

## 현재 작업 중
- (특별히 진행 중인 미완료 작업 없음 — 백엔드 1차 구현 및 실동작 검증까지 완료, 직전 요청은 /기록저장 실행)

## 다음 할 일
- Android Studio 프로젝트 시작 (Retrofit 등으로 서버 API 연동) — 다음 세션 후보
- 위험 신호 키워드 목록(`server/src/lib/riskKeywords.ts`) 전문가(의료진) 검수
- FCM 실제 발송 스케줄러(아침 리마인더 등) — 발송 함수(`push.service.ts`)만 준비된 상태, 트리거 로직 미구현
- refreshToken 만료 정책, 알림 설정 세부 항목 범위 확정 (여전히 미확정)
- `docs/*.html` 3종은 이번 세션의 .md 변경사항과 아직 미동기화 (필요 시 수동 갱신)
- 검수 가이드(`reference_guides`) 데이터는 현재 데모 시드 2종(peeling/laser_toning)뿐 — 실제 서비스 관리 유형 확장 필요

## 주요 파일
- `server/` — 백엔드 전체 (Node.js+Express+TypeScript)
  - `server/README.md` — 서버 실행 방법, 구현 시 확정 사항 정리
  - `server/db/migrations/001_init.sql`, `002_reference_guides_and_device_tokens.sql` — DB 마이그레이션
  - `server/db/seed/seed.ts` — 데모 데이터 시드
  - `server/src/services/aftercare.service.ts` — LLM 파이프라인 핵심 로직
  - `server/src/lib/riskKeywords.ts` — 위험 신호 키워드 초안(검수 필요)
  - `server/src/lib/sanitizeLlmText.ts` — LLM 출력 XML 태그 흔적 제거
  - `server/.env` — 로컬 환경변수(git 제외됨), Supabase/Anthropic 키 채워진 상태
- `README.md` — 프로젝트 개요 및 문서 인덱스 (기술스택 표에 서버/LLM/FCM 반영됨)
- `docs/api-spec.md`/`db-schema.md`/`llm-prompt-design.md` — 구현 시 확정된 사항 절 추가됨
- GitHub: https://github.com/WHS-After-Mate/Backend (main 브랜치 — 이번 세션 변경사항은 아직 커밋 전)

## 특이사항 / 결정 사항
- 클라이언트는 Android Studio(네이티브)로 확정 → 백엔드는 REST/JSON 서버(Node+Express)로 구현, FCM 전제로 알림 설계
- LLM 제공자는 Anthropic Claude API로 확정 (Claude Code 사용 환경과의 일관성 + 의료 인접 도메인 안전성 고려)
- 검수된 관리 가이드(RAG 소스) 저장 위치: 정적 파일이 아닌 DB 테이블(`reference_guides`)로 확정 — 검수자가 운영 중 직접 수정하기 쉬움
- daily-guide는 LLM 실패해도 항상 200 응답(검수 가이드로 폴백), questions는 폴백 문구를 만들기 어려워 503 유지 — 이번 세션에서 새로 확정한 정책
- Supabase는 REST API 방식(`@supabase/supabase-js`)만 사용, 직접 Postgres 연결 문자열은 안 씀 → 비밀번호 퍼센트 인코딩 이슈 해당 없음
- 세션 재시작 시 이 파일이 자동으로 브리핑됨 (글로벌 CLAUDE.md 설정)
