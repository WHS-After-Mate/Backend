# After School 현재 상태
최종 업데이트: 2026-08-13 (세션 계속)

## 프로젝트 개요
WHS After Mate — AAC 웰니스 고객용 관리 이력·이용권 조회, LLM 기반 일차별 사후관리 안내·질문, 다음 관리 추천 MVP(3주 해커톤). 앱 클라이언트는 Android Studio(네이티브 Android), 고객용 백엔드(`server/`)는 Node.js + Express + TypeScript, DB/인증은 Supabase, LLM은 Anthropic Claude API, 푸시는 FCM. 관리자용 웹(`admin-web`, **별도 GitHub 저장소 — 이 백엔드 리포에서는 절대 건드리지 않음, 로컬 클론은 `.gitignore` 처리**)과 그 백엔드(`server_admin/`, 이 리포에 포함)가 추가되어, 실제 클리닉처럼 "환자가 앱 가입 전에 의료진이 먼저 시술 이력을 입력"하는 가상 EMR 구조를 갖췄다.

## 완료된 작업
- **Tier 0~3** — 비밀번호 재설정 버그, 전화인증 제거+birthDate 추가, interestGoals 추천 로직 개선, 알림설정 완전 제거 (commit `7e62ddf`/`3b2ef51`/`501a268`/`fcb4361`, 전부 push 완료)
- **seed.ts 실제 AAC 브랜드명 반영** — commit `8a30963`, 이번 세션에 push 완료
- **가상 EMR 아키텍처 설계·구현·엔드투엔드 테스트** — 환자번호(patient_no)+24시간 인증코드로 앱 가입 신원확인. `server/db/migrations/006_add_admin_emr_staging_tables.sql`(4테이블), `server_admin/` 신규 서버(포트 4100, 무인증), `server/`의 `POST /auth/signup` 전면 교체(claim 로직), 에러코드 교체. 서버 2개 실제 기동해 환자등록→시술기록/이용권→인증코드→가입→이관 확인→재가입 차단까지 전부 통과
- **문서 4종 동기화** — `docs/api-spec.md`/`.html`(v0.5→v0.6), `db-schema.md`/`.html`(v0.3→v0.4, EMR 스테이징 4테이블 ERD·정의 추가), `server-code-guide.md`/`.html`(v0.1→v0.2, signup() 로직 상세화), `api-user-flow.html`(SIGNUP 노드·단계표 갱신) — 전부 환자번호+인증코드 기반 가입 흐름 반영
- **문서 아티팩트 4종 재발행** — api-spec/db-schema/server-code-guide/api-user-flow, claude.ai에 기존 발행분 URL 그대로 갱신(WebFetch로 최신 버전 확인 후 재발행)
- **EMR 관련 변경분 git commit + push 완료** — commit `be86a01`("Replace signup with patient-number + verification-code flow (virtual EMR)"), `8a30963`와 함께 origin/main에 반영 완료(`fcb4361..be86a01`)

## 현재 작업 중
- (없음 — 이번 EMR 작업 사이클은 문서 동기화·아티팩트 재발행·commit·push까지 전부 완료된 상태)

## 다음 할 일
- admin-web에 실제 화면 구현: 환자 등록 폼, 시술기록/이용권 입력, 인증코드 발급 버튼 — `server_admin` API와 연동 (**단, admin-web 저장소 자체는 프론트 담당자 영역이므로 이 백엔드 세션에서는 작업하지 않음. 필요 시 별도로 명확히 지시받을 것**)
- README TODO: Supabase 커스텀 SMTP 연동(Resend/SendGrid), SMS 실연동
- (이월) Render 배포 여부/시점 결정
- (이월) 프론트 담당자 GitHub Collaborator 초대 미발송
- (이월) `.env` 비밀값을 프론트 담당자에게 git 아닌 채널로 전달
- (이월) 위험 신호 키워드 목록(`server/src/lib/riskKeywords.ts`) 전문가(의료진) 검수
- (이월) FCM 실제 발송 스케줄러 트리거 로직 미구현
- (이월) refreshToken 만료 정책 확정 미완료
- (이월) `docs/llm-prompt-design.html`은 여전히 .md 변경사항과 미동기화
- (이월) baseUrl 상수화 가이드를 `frontend-integration-guide.md`에 반영할지 결정
- (이월) `.work-log/dd.txt` 계속 보관할지/삭제할지 — EMR 항목(Tier 5)이 이번 세션으로 완료됨, 재검토 필요
- (이월) `docs/AAC_클리닉_자산_조사.docx` git 커밋 여부 여전히 미결정(untracked)

## 주요 파일
- `server/db/migrations/006_add_admin_emr_staging_tables.sql` — 가상 EMR 스테이징 4테이블, 적용+커밋 완료
- `server/src/services/auth.service.ts` — signup()이 patientNo+코드로 emr_patients를 claim, 실제 테이블로 1회성 이관
- `server/src/validators/auth.validators.ts`, `routes/auth.routes.ts`, `lib/errors.ts` — signup 스키마·에러코드 교체
- `server_admin/` — 관리자 API 서버(포트 4100, 무인증, **이 백엔드 리포 소속**). `src/services/patients.service.ts`가 핵심 로직
- `admin-web/` — **별도 GitHub 저장소(`WHS-After-Mate/admin-web`), 이 리포와 무관.** 로컬 클론은 참고용일 뿐 `.gitignore` 처리돼 있고, 이 세션에서 손대지 않음(사용자 지시)
- `docs/api-spec.md`/`.html`, `db-schema.md`/`.html`, `server-code-guide.md`/`.html`, `api-user-flow.html` — v0.6/v0.4/v0.2로 동기화 완료, claude.ai 아티팩트도 최신화됨
- `docs/AAC_클리닉_자산_조사.docx` — 사용자 제공 실제 AAC 브랜드 조사 자료(untracked)
- GitHub: https://github.com/WHS-After-Mate/Backend (main, 최신 push `be86a01` — EMR 작업+문서 동기화 전부 push 완료)

## 특이사항 / 결정 사항
- **admin-web은 이 백엔드 세션의 작업 범위 밖**: 사용자가 명시적으로 "admin-web 레포지토리는 건들면 안 된다, 백엔드 레포지토리만 이용해야 한다"고 확인함. `server_admin/`(백엔드 API)까지는 이 리포 소관이지만 `admin-web/`(프론트) 저장소는 별개이며 스테이징 대상도 아님 — git status/커밋 내역으로 실제 미포함 확인됨
- **회원가입 방식 전면 변경 배경**: 원래 목표는 "의사가 먼저 입력한 의료 데이터 → 환자가 나중에 정확한 정보로 가입하면 그 데이터 기반 사후케어"였음. placeholder Auth 계정을 미리 만드는 방식은 (1) 진짜 가입 시 별개 계정이 생겨 매칭 안 됨 (2) 기존 `PHONE_ALREADY_EXISTS` 체크가 오히려 가입을 막음 (3) `medical_profiles.user_id`가 PK라 계정 이관 시 PK 스왑이 필요 — 세 가지 문제로 기각. 사용자가 직접 "환자번호+인증코드" 방식을 제안했고, 이게 세 문제를 전부 해결함
- **claim은 1회성, 지속 동기화 아님**: claim 이후 emr_* 테이블에 새로 추가한 기록은 앱에 반영 안 됨(의도적 범위 제한). 시도하면 `409 PATIENT_ALREADY_CLAIMED`로 막아 혼란 방지
- **admin-web(제품 자체)은 의도적으로 인증 없음**: "데모 버전이라 항상 열려있을 것"이라는 사용자 결정. 실서비스 전환 시 반드시 관리자 인증 추가 필요(README에 명시)
- **Windows tsx watch 재시작 이슈**: 파일 저장 → 자동 재시작 시 이전 프로세스가 포트를 즉시 놓지 않아 `EADDRINUSE`로 전체가 죽는 경우 관찰됨. 로컬에서 안정적으로 띄우려면 `npm run build` 후 `node dist/src/server.js` 권장
- Render 배포 시점 결정은 여전히 보류 상태
- 세션 재시작 시 이 파일이 자동으로 브리핑됨 (글로벌 CLAUDE.md 설정)
