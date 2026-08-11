# After School 현재 상태
최종 업데이트: 2026-08-11 15:09

## 프로젝트 개요
WHS After Mate — AAC 웰니스 고객용 관리 이력·이용권 조회, LLM 기반 일차별 사후관리 안내·질문, 다음 관리 추천 MVP(3주 해커톤). 앱 클라이언트는 Android Studio(네이티브 Android), 백엔드는 Node.js + Express + TypeScript, DB/인증은 Supabase, LLM은 Anthropic Claude API, 푸시는 FCM으로 확정하고 실제 구현·연동까지 완료한 상태.

## 완료된 작업
- (08-05 저녁, 당시 미기록) **비밀번호 재설정 버그 발견 및 수정** — `server/src/services/auth.service.ts`의 `confirmPasswordReset`이 Supabase `token_hash` 방식(`verifyOtp`)을 가정하고 있었으나, 실제 기본 "Reset Password" 메일 템플릿은 이미 검증된 `access_token`을 리다이렉트 URL 해시로 실어 보내는 방식임을 실사용 링크로 실측 확인. `verifyOtp({token_hash, type:"recovery"})` → `getUser(recoveryToken)` 기반 검증으로 교체, 세션 무효화도 `data.session.access_token` → `recoveryToken` 그대로 사용하도록 수정
  - `requestPasswordReset`에도 Supabase 에러 발생 시 콘솔 로깅 추가(클라이언트 응답은 계정 존재 여부 비노출을 위해 항상 성공 처리 유지)
- (08-05 저녁, 당시 미기록) **문서 동기화** — `docs/api-spec.md`에 `recoveryToken`이 `token_hash`가 아니라 `access_token`이라는 설명 추가. `server/README.md`에 SMS 미구현/개발모드 동작, 비밀번호 찾기는 실제 메일이 발송된다는 점 명시 + "TODO — 프로덕션 전 처리 필요" 섹션 신규 추가(Supabase 커스텀 SMTP 연동 필요 — 시간당 2통 제한 때문, SMS 실연동 필요)
- (08-05 저녁, 당시 미기록) **신규 파일 `server/src/examples/api-call-example.html`** 제작 — 프론트(Android) 담당자용 순수 `fetch()` 기반 브라우저 테스트 페이지. A) 회원가입(전화인증 3단계) B) 기존 계정 로그인→홈 요약 C) 비밀번호 찾기(실제 메일 발송) 세 시나리오를 버튼으로 실행. 코드 전체에 초보자용 상세 주석(화살표함수/템플릿리터럴/await 등) 포함
- (08-06, 이전 세션) 위 변경사항이 git status/diff엔 있는데 work-log(최종 업데이트 08-05 00:34)와 마지막 커밋(08-05 17:23)에는 반영 안 돼 있는 걸 발견 → 파일 mtime(08-05 21:25~21:39, 즉 마지막 커밋·work-log 저장 이후) 대조로 "어제 저녁 세션에서 작업은 했는데 `/기록저장` 없이 세션 종료돼 기록이 누락됐다"고 결론, 사용자에게 브리핑 후 work-log 소급 갱신
- (08-11, 이번 세션) `.work-log/dd.txt`(사용자가 남긴 untracked 메모)를 정식 변경 요구사항으로 확인 — 전화인증 API 제거, `phone_verifications` 테이블 제거, 회원가입 비밀번호/이메일 검증 강화, 생년월일 필드 추가, `interestGoals`→추천 AI 반영, 알림설정 단순화, 가상 EMR 사이트 필요 등. Tier 0~5로 우선순위 정리 (아래 "다음 할 일" 참고)
- (08-11) `/aftercare/questions`가 "LLM"이 아니라 진짜 AI API를 쓰는지 사용자가 재확인 요청 → `server/src/services/llm/client.ts`(`callStructuredLlm`)가 실제로 `@anthropic-ai/sdk`의 `anthropic.messages.create`를 호출함을 코드로 확인. 스펙 문서의 "LLM 기반" 표현이 헷갈릴 수 있다는 피드백에 따라 `docs/api-spec.md`/`.html`에 "실제 Anthropic Claude API를 호출하며 하드코딩된 템플릿이 아니다"라는 설명 추가, 아티팩트 재발행
- (08-11) `server/src/examples/api-call-example.html`에 **D. 사후관리 질문(AI 답변) 실험** 섹션 신규 추가 — `POST /aftercare/questions`(카테고리 드롭다운·위험신호 차단 확인 가능)·`GET /aftercare/questions` 테스트 버튼. 로그인(B) 후 받은 `accessToken`을 재사용하도록 스크립트 최상단 공용 변수로 리팩터링
- (08-11) 위 전체(08-05 저녁분 + 08-11 오늘분) git commit/push 완료 — `7e62ddf`, `WHS-After-Mate/Backend` main에 반영(`9eb1af2..7e62ddf`)
- (08-11) **Tier 1 완료 — 전화인증 SMS 제거 + 회원가입 생년월일 추가**:
  - 전화인증 완전 제거: `auth.routes.ts`의 `verify-phone/request`·`/confirm` 라우트 삭제, `auth.validators.ts`의 관련 스키마·`phoneVerifiedToken` 삭제, `auth.service.ts`의 `requestPhoneVerification`/`confirmPhoneVerification` 삭제 + `signup()`을 토큰검증 없이 바로 가입하도록 단순화, `lib/otp.ts`/`lib/sms.ts`/`lib/signedToken.ts` 파일 자체 삭제, `errors.ts`에서 관련 에러 6종 제거하고 `phoneAlreadyExists`(409) 신규 추가, `env.ts`/`.env.example`에서 `APP_TOKEN_SECRET`/`SMS_*` 제거
  - DB 마이그레이션 `server/db/migrations/004_remove_phone_verification.sql` 신규 작성 — `phone_verifications` 테이블 삭제 + `profiles.phone_verified_at` 컬럼 삭제 (아직 Supabase에 미적용, 수동 실행 필요)
  - `db/seed/seed.ts`에서 `phone_verified_at` insert 제거
  - `POST /auth/signup`에 `birthDate`(필수, YYYY-MM-DD) 필드 추가 → `profiles.birth_date`에 바로 저장(기존엔 `PATCH /profile`로만 채울 수 있었음). 비밀번호 8자 이상·이메일 형식 검증은 이미 구현돼 있었음(추가 작업 불필요)
  - `npm run typecheck` 통과 확인
  - `server/src/examples/api-call-example.html` A섹션을 3단계 SMS 플로우 → 단일 회원가입 버튼(생년월일 필드 포함)으로 축소, `accessToken` 재사용 구조 유지
  - 문서 전체 동기화: `docs/api-spec.md`/`.html`(엔드포인트·에러코드·데이터모델 표), `server/README.md`, `docs/db-schema.md`/`.html`(ERD·테이블 정의·트레이드오프 + 004 변경 이력 섹션 신규), `docs/server-code-guide.md`/`.html`(인증 흐름 재작성), `docs/api-user-flow.html`(다이어그램 노드·단계표), `docs/frontend-integration-guide.md`/`.html`(env 변수 표) — 관련 아티팩트 5개 전부 재발행
  - **아직 git 미커밋** — 다음 세션에서 커밋 필요

## 현재 작업 중
- Tier 0·Tier 1 완료, 전부 아직 git 미commit 상태 (Tier 1은 코드+마이그레이션+문서 전체 변경이라 다음 세션 시작 시 diff 재확인 후 커밋 권장)
- DB 마이그레이션 004는 로컬 파일만 작성됨 — 실제 Supabase 프로젝트에는 아직 미적용 (Supabase SQL Editor에서 수동 실행 필요)

## 다음 할 일 (우선순위, 08-11 정리)
- **Tier 1 후속**: 위 변경사항 git commit/push, 마이그레이션 004를 Supabase에 실제 적용
- **Tier 2**: `interestGoals`를 다음 시술 추천 AI 프롬프트에 실제 반영 (`/profile birthDate` 자동 반영은 Tier 1의 signup 변경으로 이미 완료됨)
- **Tier 3**: `/notifications/settings` 푸시 관련 항목 노출 제거(단순화)
- **Tier 5 (별도 규모, 후순위)**: 의료정보 가상 EMR 사이트/API 신규 구축
- README TODO에 남긴 프로덕션 전 처리 항목: Supabase 커스텀 SMTP 연동(Resend/SendGrid 등), SMS 실제 연동(국내 중계업체 계약+발신번호 등록)
- (이월) Render 배포 여부/시점 결정 — "내일 논의하자"로 보류된 채 아직 미해결
- (이월) 프론트 담당자 GitHub Collaborator 초대 미발송
- (이월) `.env` 비밀값을 프론트 담당자에게 git 아닌 채널로 전달
- (이월) 위험 신호 키워드 목록(`server/src/lib/riskKeywords.ts`) 전문가(의료진) 검수
- (이월) FCM 실제 발송 스케줄러(아침 리마인더 등) 트리거 로직 미구현
- (이월) refreshToken 만료 정책, 알림 설정 세부 항목 범위 확정 미완료
- (이월) `docs/db-schema.html`/`llm-prompt-design.html`은 여전히 .md 변경사항과 미동기화
- (이월) baseUrl 상수화(`ApiConfig`/`buildConfigField`) 가이드를 `frontend-integration-guide.md`에 반영할지 결정

## 주요 파일
- `server/src/services/auth.service.ts`/`auth.routes.ts`/`auth.validators.ts` — 전화인증 제거 + signup에 birthDate 추가(미커밋)
- `server/db/migrations/004_remove_phone_verification.sql` — 신규, Supabase 미적용
- `server/src/lib/otp.ts`/`sms.ts`/`signedToken.ts` — 삭제됨
- `docs/api-spec.md`/`.html`, `server/README.md`, `docs/db-schema.md`/`.html`, `docs/server-code-guide.md`/`.html`, `docs/api-user-flow.html`, `docs/frontend-integration-guide.md`/`.html` — 전화인증 제거 반영해 전부 동기화(미커밋)
- `server/src/examples/api-call-example.html` — A(회원가입 단순화)/B/C(08-05) + D 사후관리 질문 테스트(08-11) 포함, 미커밋
- `.work-log/dd.txt` — 사용자 메모 원본(untracked) — 내용 전부 이 파일에 정식 반영됨. 계속 보관할지/삭제할지 사용자 확인 필요
- GitHub: https://github.com/WHS-After-Mate/Backend (main 브랜치, 최신 push `7e62ddf` — Tier 1 변경은 아직 미반영)

## 특이사항 / 결정 사항
- **재발 방지 포인트**: 세션 종료 전 `/기록저장`을 안 하면 다음 세션 자동 브리핑에서 실제로 했던 작업이 누락될 수 있음 — 08-05 저녁 작업이 6일간(08-11까지) 미커밋 상태로 방치됐던 전례가 있으니 유의
- **confirmPasswordReset 핵심 발견**: Supabase 기본 "Reset Password" 메일 템플릿은 커스텀 `token_hash` 검증 방식이 아니라, Supabase가 자체 `/auth/v1/verify`에서 먼저 검증을 마친 뒤 이미 발급된 recovery 세션의 `access_token`을 URL 해시로 넘겨주는 방식 — 실사용 링크로 실측 확인한 내용이라 재현 시 참고
- **`/aftercare/questions`는 이미 실제 Claude API 호출**: "LLM"이라는 표현 때문에 목업처럼 보일 수 있었으나, `callStructuredLlm()` → `anthropic.messages.create()`로 실제 API 호출 확인됨. 문서에 명시적으로 반영함
- Render 배포 시점 결정은 여전히 보류 상태 (08-05부터 이월)
- 세션 재시작 시 이 파일이 자동으로 브리핑됨 (글로벌 CLAUDE.md 설정)
