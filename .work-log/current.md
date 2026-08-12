# After School 현재 상태
최종 업데이트: 2026-08-12 (Tier 3까지 완료, 후속 결정 대기 중)

## 프로젝트 개요
WHS After Mate — AAC 웰니스 고객용 관리 이력·이용권 조회, LLM 기반 일차별 사후관리 안내·질문, 다음 관리 추천 MVP(3주 해커톤). 앱 클라이언트는 Android Studio(네이티브 Android), 백엔드는 Node.js + Express + TypeScript, DB/인증은 Supabase, LLM은 Anthropic Claude API, 푸시는 FCM으로 확정하고 실제 구현·연동까지 완료한 상태.

## 완료된 작업
- **Tier 0** — 비밀번호 재설정 버그 수정, `/aftercare/questions`가 실제 Anthropic Claude API를 호출함을 검증해 문서화 — commit `7e62ddf`
- **Tier 1** — 전화인증 SMS 기능 전체 제거 + 회원가입에 `birthDate` 필드 추가, 마이그레이션 `004_remove_phone_verification.sql` 적용·검증 — commit `3b2ef51`
- **Tier 2** — `interestGoals` → 다음 시술 추천 로직 반영/개선 — commit `501a268` (push 완료)
  - 추천은 LLM이 아니라 `recommendations.service.ts`의 규칙 기반 로직임을 확인. 매칭 로직을 `goal.slice(0, 2)`(앞 2글자 substring) → `KEYWORD_GROUPS`/`tagsFor()` 기반 태그 교집합 비교로 개선
  - 사용자가 `docs/AAC_클리닉_자산_조사.docx`(실제 AAC 회사·클리닉 브랜드 조사: AMRED/DERNA/WIM + 웰니스하우스서울) 제공. 이번 Tier는 "추천 로직 개선만"으로 범위를 한정, seed 데이터의 브랜드명/시술명 실데이터 교체는 별도 후속 작업으로 분리(미착수)
- **Tier 3** — `/notifications/settings` 알림설정 완전 제거 — commit `fcb4361` (push 완료)
  - `pushEnabled`/`aftercareReminder`/`membershipExpiryAlert`/`marketingAlert` 4개 값 모두 DB에 저장만 될 뿐 실제로 읽어 분기하는 발송 로직이 전혀 없는 placeholder였음을 코드로 확인(발송 스케줄러 자체 미구현) — 사용자 확인으로 GET/PATCH 엔드포인트 완전 제거로 결정
  - `notifications.routes.ts`/`notifications.service.ts`에서 settings 관련 라우트·서비스 함수 삭제(device-token 등록/해제는 실제로 쓰이므로 유지), `profile.validators.ts`의 `updateNotificationSettingsSchema` 삭제
  - 신규 마이그레이션 `005_remove_notification_settings.sql` 작성(`profiles`의 4개 컬럼 삭제, 아직 Supabase 미적용)
  - `npm run typecheck`/`npm run build` 통과
  - 문서 전체 동기화: `docs/api-spec.md`/`.html`(엔드포인트·데이터모델·미확정사항·v0.5 이력 테이블), `docs/db-schema.md`/`.html`(ERD·컬럼표·설계결정 카드·신규 "알림 설정 제거(005)" 절), `docs/server-code-guide.md`/`.html`, `docs/api-user-flow.html`(mermaid 노드/엣지·스텝 테이블), `README.md`/`server/README.md`

## 현재 작업 중
- Tier 0~3 전부 commit/push 완료 (`fcb4361`까지)
- 마이그레이션 `005`를 사용자가 Supabase SQL Editor에서 직접 실행 → service role key로 4개 컬럼(`push_enabled`/`aftercare_reminder`/`membership_expiry_alert`/`marketing_alert`) 조회하는 임시 스크립트(`server/src/_verify-005-tmp.ts`)로 전부 삭제됨 확인, 스크립트는 확인 후 삭제 — **완료**
- `docs/AAC_클리닉_자산_조사.docx`는 여전히 untracked (커밋 여부 미결정)
- 문서 HTML 아티팩트(api-spec/db-schema/server-code-guide/api-user-flow) 4종 전부 최신 로컬 `.html`(Tier 3 알림설정 제거 반영)로 재발행 완료 — **완료**
  - 재발행 중 `api-spec` 아티팩트가 2개(중복) 발견됨: 최신본(`5cf6ed55...`, 08-11 이후 Tier1 반영됨)에 재발행, 구버전(`5462bb46...`, 08-05 이후 미갱신·전화인증 잔존)은 건드리지 않고 방치 — 사용자 확인 후 삭제 여부 결정 필요

- **Tier 2 후속(seed.ts 브랜드명 교체)** — `AAC_클리닉_자산_조사.docx` 기준 실제 AAC 브랜드로 시드 데이터 교체 완료
  - `server/db/seed/seed.ts`: 가상 브랜드 "AAC 청담"→"AMRED CLINIC"(청담, 리프팅 전문), "AAC 강남"→"DERNA CLINIC"(웰니스하우스서울 B1, 대중형) — 홍길동·이서준의 청담 시술 2건, 김민지의 강남 시술 1건 교체(store 값도 각각 "AMRED CLINIC 청담점"/"DERNA CLINIC (웰니스하우스서울 B1)"로 변경). 시술명(브라이트닝 필링/레이저 토닝)·담당의·care_type은 이번 범위 밖이라 유지(WIM Clinic/Center는 이번 시드에 미사용)
  - `docs/api-spec.md`/`.html`의 예시 JSON(홍길동 브라이트닝 필링 케이스)도 동일하게 동기화
  - `npm run typecheck` 통과, `npm run seed` 재실행 + service role key로 `care_records.brand/store` 직접 조회해 실제 반영 확인(검증 스크립트는 확인 후 삭제)
  - 아직 git commit 안 함

## 다음 할 일
- (신규) 중복 발행된 구버전 API 명세서 아티팩트(`5462bb46-4020-4af8-ba71-cfb8c62f407e`) 삭제할지 확인
- (신규) seed.ts 브랜드명 교체분 commit — 아직 미커밋
- (신규) 문서 아티팩트(api-spec) 재발행 여부 — 예시 JSON 브랜드명 변경분 아직 아티팩트에 미반영
- (분리된 후속 작업, 미착수) seed.ts의 가상 브랜드명(`"AAC 청담"`/`"AAC 강남"`)·가상 시술명을 `AAC_클리닉_자산_조사.docx` 기준 실제 브랜드(AMRED CLINIC/DERNA CLINIC/WIM Clinic·Center)로 교체할지 여부 — 사용자 결정 필요
- **Tier 5 (별도 규모, 후순위)**: 의료정보 가상 EMR 사이트/API 신규 구축
- README TODO: Supabase 커스텀 SMTP 연동(Resend/SendGrid), SMS 실연동
- (이월) Render 배포 여부/시점 결정 — 계속 보류
- (이월) 프론트 담당자 GitHub Collaborator 초대 미발송
- (이월) `.env` 비밀값을 프론트 담당자에게 git 아닌 채널로 전달
- (이월) 위험 신호 키워드 목록(`server/src/lib/riskKeywords.ts`) 전문가(의료진) 검수
- (이월) FCM 실제 발송 스케줄러(아침 리마인더 등) 트리거 로직 미구현
- (이월) refreshToken 만료 정책 확정 미완료
- (이월) `docs/llm-prompt-design.html`은 여전히 .md 변경사항과 미동기화
- (이월) baseUrl 상수화(`ApiConfig`/`buildConfigField`) 가이드를 `frontend-integration-guide.md`에 반영할지 결정
- (이월) `.work-log/dd.txt` 계속 보관할지/삭제할지 결정 필요 — dd.txt의 항목 전부(전화인증 제거, 생년월일, interestGoals 반영, 알림설정 단순화) 이번 Tier 3로 완료됨. EMR 항목(Tier 5)만 남음

## 주요 파일
- `server/src/routes/notifications.routes.ts`/`services/notifications.service.ts` — Tier 3: settings 라우트/서비스 삭제, device-token만 유지
- `server/src/validators/profile.validators.ts` — `updateNotificationSettingsSchema` 삭제
- `server/db/migrations/005_remove_notification_settings.sql` — 아직 Supabase 미적용
- `server/src/services/recommendations.service.ts` — Tier 2: `KEYWORD_GROUPS`/`tagsFor()` 신설, `interestGoals` 매칭 로직 교체
- `docs/AAC_클리닉_자산_조사.docx` — 사용자 제공, 실제 AAC 회사/클리닉 브랜드 조사 자료(untracked)
- `server/src/services/auth.service.ts`/`auth.routes.ts`/`auth.validators.ts` — Tier 1: 전화인증 제거 + signup에 birthDate 추가
- `server/db/seed/seed.ts` — 4명 데모 고객 시드. 브랜드명/시술명이 아직 가상 값(Tier 2 후속 작업 후보)
- GitHub: https://github.com/WHS-After-Mate/Backend (main 브랜치, 최신 push `fcb4361`)

## 특이사항 / 결정 사항
- **재발 방지 포인트**: 세션 종료 전 `/기록저장`을 안 하면 다음 세션 자동 브리핑에서 실제로 했던 작업이 누락될 수 있음 — 08-05 저녁 작업이 6일간 미커밋 상태로 방치됐던 전례가 있으니 유의
- **Tier 3 핵심 발견**: 알림설정 4개 필드(pushEnabled 등)는 DB 저장만 될 뿐 어디서도 실제로 읽어서 분기하지 않는 순수 placeholder였음(발송 스케줄러 자체가 없어서 `push.service.ts`의 `sendPushToUser`도 이 값들을 전혀 체크 안 함) — 그래서 "단순화"가 아니라 완전 제거로 결정
- **Tier 2 스코프 결정**: 실제 AAC 클리닉 브랜드/시술 자료(`AAC_클리닉_자산_조사.docx`)가 있었지만, seed 데이터 브랜드명·시술명 전면 교체는 범위가 넓어 별도 작업으로 분리(사용자가 명시적으로 선택)
- **추천은 LLM이 아니라 규칙 기반**: `/aftercare/questions`·`/aftercare/daily-guide`와 달리 "다음 시술 추천"(`recommendations.service.ts`)은 Claude API를 호출하지 않고 순수 키워드 매칭 규칙으로 동작
- `confirmPasswordReset` 핵심 발견: Supabase 기본 "Reset Password" 메일 템플릿은 `token_hash` 검증 방식이 아니라 이미 발급된 recovery 세션의 `access_token`을 URL 해시로 넘겨주는 방식 — 실사용 링크로 실측 확인
- Render 배포 시점 결정은 여전히 보류 상태 (08-05부터 이월)
- 세션 재시작 시 이 파일이 자동으로 브리핑됨 (글로벌 CLAUDE.md 설정)
