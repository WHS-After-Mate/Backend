# After School 현재 상태
최종 업데이트: 2026-08-11 (Tier 2 진행 중)

## 프로젝트 개요
WHS After Mate — AAC 웰니스 고객용 관리 이력·이용권 조회, LLM 기반 일차별 사후관리 안내·질문, 다음 관리 추천 MVP(3주 해커톤). 앱 클라이언트는 Android Studio(네이티브 Android), 백엔드는 Node.js + Express + TypeScript, DB/인증은 Supabase, LLM은 Anthropic Claude API, 푸시는 FCM으로 확정하고 실제 구현·연동까지 완료한 상태.

## 완료된 작업
- **Tier 0** — 비밀번호 재설정 버그 수정(`confirmPasswordReset`을 실제 Supabase 메일 템플릿 방식인 `access_token` 기반 검증으로 교체), `/aftercare/questions`가 실제 Anthropic Claude API를 호출함을 코드로 검증해 문서에 명시, `api-call-example.html`에 D(사후관리 질문 테스트) 섹션 추가 — commit `7e62ddf`
- **Tier 1** — 전화인증 SMS 기능 전체 제거(`verify-phone/request`·`/confirm` 라우트, `phoneVerifiedToken`, `otp.ts`/`sms.ts`/`signedToken.ts` 삭제) + 회원가입에 `birthDate` 필드 추가, DB 마이그레이션 `004_remove_phone_verification.sql` 작성 및 Supabase에 실제 적용·검증 완료, 관련 문서 5종 전부 동기화 — commit `3b2ef51`
- **Tier 2 (진행 중, 아직 미커밋)** — `interestGoals` → 다음 시술 추천 로직 반영/개선
  - 조사 결과 추천은 LLM이 아니라 `recommendations.service.ts`의 규칙 기반 로직이었고, `interestGoals` 매칭은 이미 존재했으나 `goal.slice(0, 2)`(앞 2글자 substring)라 부정확했음을 확인
  - 사용자가 `docs/AAC_클리닉_자산_조사.docx`(실제 AAC 회사·클리닉 브랜드 조사 자료: AMRED/DERNA/WIM + 웰니스하우스서울) 제공 — 이번 작업 범위는 "추천 로직 개선만"으로 한정, 브랜드명/시술명 실데이터 교체는 별도 작업으로 분리하고 이번엔 미착수
  - `recommendations.service.ts`: `POPULAR_TAG_RULES` → `KEYWORD_GROUPS`(태그↔키워드 양방향)로 일반화, `tagsFor()` 헬퍼로 `popularTagsFor()`와 `interestGoals` 매칭이 같은 어휘를 공유하도록 리팩터링. 매칭 방식을 앞글자 substring → 태그 교집합 비교로 교체
  - `npm run typecheck` 통과, `docs/server-code-guide.md`의 상수명 참조 동기화 완료

## 현재 작업 중
- Tier 2 코드 변경은 완료됐으나 **git commit/push 전 상태**
- `docs/AAC_클리닉_자산_조사.docx`는 untracked 상태로 `docs/`에 남아있음(커밋 여부 미결정)

## 다음 할 일
- Tier 2 변경사항 git commit/push
- (분리된 후속 작업, 미착수) seed.ts의 가상 브랜드명(`"AAC 청담"`/`"AAC 강남"`)·가상 시술명을 `AAC_클리닉_자산_조사.docx` 기준 실제 브랜드(AMRED CLINIC/DERNA CLINIC/WIM Clinic·Center)로 교체할지 여부 — 사용자 결정 필요
- **Tier 3**: `/notifications/settings` 푸시 관련 항목 노출 제거(단순화)
- **Tier 5 (별도 규모, 후순위)**: 의료정보 가상 EMR 사이트/API 신규 구축
- README TODO: Supabase 커스텀 SMTP 연동(Resend/SendGrid), SMS 실연동
- (이월) Render 배포 여부/시점 결정 — 계속 보류
- (이월) 프론트 담당자 GitHub Collaborator 초대 미발송
- (이월) `.env` 비밀값을 프론트 담당자에게 git 아닌 채널로 전달
- (이월) 위험 신호 키워드 목록(`server/src/lib/riskKeywords.ts`) 전문가(의료진) 검수
- (이월) FCM 실제 발송 스케줄러(아침 리마인더 등) 트리거 로직 미구현
- (이월) refreshToken 만료 정책, 알림 설정 세부 항목 범위 확정 미완료
- (이월) `docs/db-schema.html`/`llm-prompt-design.html`은 여전히 .md 변경사항과 미동기화
- (이월) baseUrl 상수화(`ApiConfig`/`buildConfigField`) 가이드를 `frontend-integration-guide.md`에 반영할지 결정
- (이월) `.work-log/dd.txt` 계속 보관할지/삭제할지 결정 필요(내용은 이미 이 파일에 반영됨)

## 주요 파일
- `server/src/services/recommendations.service.ts` — Tier 2: `KEYWORD_GROUPS`/`tagsFor()` 신설, `interestGoals` 매칭 로직 교체
- `docs/server-code-guide.md` — `POPULAR_TAG_RULES`→`KEYWORD_GROUPS` 참조 동기화
- `docs/AAC_클리닉_자산_조사.docx` — 사용자 제공, 실제 AAC 회사/클리닉 브랜드 조사 자료(untracked)
- `server/src/services/auth.service.ts`/`auth.routes.ts`/`auth.validators.ts` — Tier 1: 전화인증 제거 + signup에 birthDate 추가
- `server/db/migrations/004_remove_phone_verification.sql` — Supabase 실제 프로젝트에 적용 완료(검증됨)
- `server/db/seed/seed.ts` — 4명 데모 고객 시드. 브랜드명/시술명이 아직 가상 값(Tier 2 후속 작업 후보)
- GitHub: https://github.com/WHS-After-Mate/Backend (main 브랜치, 최신 push `3b2ef51`)

## 특이사항 / 결정 사항
- **재발 방지 포인트**: 세션 종료 전 `/기록저장`을 안 하면 다음 세션 자동 브리핑에서 실제로 했던 작업이 누락될 수 있음 — 08-05 저녁 작업이 6일간 미커밋 상태로 방치됐던 전례가 있으니 유의
- **Tier 2 스코프 결정**: 사용자가 실제 AAC 클리닉 브랜드/시술 자료를 제공했지만, 이번 세션에서는 "추천 매칭 로직 정확도 개선"에만 한정하기로 결정 — seed 데이터의 브랜드명·시술명을 실데이터로 전면 교체하는 건 범위가 넓어 별도 작업으로 분리(사용자가 명시적으로 선택)
- **추천은 LLM이 아니라 규칙 기반**: `/aftercare/questions`·`/aftercare/daily-guide`와 달리 "다음 시술 추천"(`recommendations.service.ts`)은 Claude API를 호출하지 않고 순수 키워드 매칭 규칙으로 동작 — dd.txt의 "추천 AI 반영"이라는 표현과 달리 실제로는 AI가 아님
- `confirmPasswordReset` 핵심 발견: Supabase 기본 "Reset Password" 메일 템플릿은 `token_hash` 검증 방식이 아니라 이미 발급된 recovery 세션의 `access_token`을 URL 해시로 넘겨주는 방식 — 실사용 링크로 실측 확인
- Render 배포 시점 결정은 여전히 보류 상태 (08-05부터 이월)
- 세션 재시작 시 이 파일이 자동으로 브리핑됨 (글로벌 CLAUDE.md 설정)
