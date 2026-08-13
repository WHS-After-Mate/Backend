# After School 현재 상태
최종 업데이트: 2026-08-13 01:07

## 프로젝트 개요
WHS After Mate — AAC 웰니스 고객용 관리 이력·이용권 조회, LLM 기반 일차별 사후관리 안내·질문, 다음 관리 추천 MVP(3주 해커톤). 앱 클라이언트는 Android Studio(네이티브 Android), 고객용 백엔드(`server/`)는 Node.js + Express + TypeScript, DB/인증은 Supabase, LLM은 Anthropic Claude API, 푸시는 FCM. 여기에 이번 세션부터 관리자용 웹(`admin-web`, 별도 GitHub 저장소)과 그 백엔드(`server_admin/`)가 추가되어, 실제 클리닉처럼 "환자가 앱 가입 전에 의료진이 먼저 시술 이력을 입력"하는 가상 EMR 구조를 갖췄다.

## 완료된 작업
- **Tier 0~3** — 비밀번호 재설정 버그, 전화인증 제거+birthDate 추가, interestGoals 추천 로직 개선, 알림설정 완전 제거 (commit `7e62ddf`/`3b2ef51`/`501a268`/`fcb4361`, 전부 push 완료)
- **마이그레이션 005 Supabase 적용 + 문서 아티팩트 4종 재발행** — api-spec/db-schema/server-code-guide/api-user-flow, 중복 발행됐던 구버전 api-spec 아티팩트는 사용자가 직접 삭제
- **seed.ts 실제 AAC 브랜드명 반영** — "AAC 청담"→"AMRED CLINIC", "AAC 강남"→"DERNA CLINIC", `docs/api-spec.md`/`.html` 예시 동기화, api-spec 아티팩트 재발행 — commit `8a30963` (아직 push 안 함)
- **admin-web 저장소 클론 확인** — `https://github.com/WHS-After-Mate/admin-web.git`을 로컬 `admin-web/`(gitignore 처리, 이 리포에는 미포함)로 클론. React 19 + Vite 8 기본 스캐폴드뿐, 실제 화면은 아직 없음을 확인
- **가상 EMR 아키텍처 설계·구현 (신규 대작업)**
  - 논의 끝에 "환자번호(patient_no) + 24시간 유효 인증코드로 앱 가입을 신원확인"하는 구조로 확정(사용자 제안) — placeholder Auth 계정을 미리 만드는 방식은 기존 회원가입의 `PHONE_ALREADY_EXISTS` 체크와 충돌하고 PK 스왑이 필요해 기각
  - `server/db/migrations/006_add_admin_emr_staging_tables.sql` 작성·적용 완료 — `emr_patients`/`emr_care_records`/`emr_memberships`/`signup_verification_codes` 4개 테이블, `auth.users`와 완전히 무관하게 독립 존재
  - **`server_admin/` 신규 서버** — `server/`와 동일 컨벤션(routes/services/validators/config/middleware, Express+TS+zod), 포트 4100, admin-web에 로그인 없음(사용자 결정, 항상 열림). 환자 CRUD, 시술기록/이용권 추가·삭제, 인증코드 발급 API 구현
  - **`server/`의 `POST /auth/signup` 전면 교체** — 기존 `{email,password,name,phone,birthDate}` → `{patientNo,verificationCode,email,password}`. 이름/전화/생년월일은 클라이언트 입력이 아니라 `emr_patients` 원본에서 가져옴. 성공 시 `emr_care_records`/`emr_memberships`를 실제 `care_records`/`memberships`로 1회성 이관(claim), 실패 시 방금 만든 Auth 유저 롤백(CASCADE로 하위 테이블 자동 정리)
  - `phoneAlreadyExists` 에러 제거, `patientNotFound`/`patientAlreadyClaimed`/`invalidOrExpiredVerificationCode` 신규 추가
  - **엔드투엔드 실제 테스트 완료** — 서버 2개(포트 4000/4100)를 실제로 띄워서 환자 등록→시술기록/이용권 추가→인증코드 발급→그 코드로 회원가입→`GET /profile`·`/care-records`·`/memberships`로 이관 데이터 확인→재사용 시 `409 PATIENT_ALREADY_CLAIMED` 확인까지 전부 통과. 테스트 중 발견한 이슈:
    - Windows에서 `tsx watch`가 파일 저장 시 재시작하며 `EADDRINUSE`로 죽는 경우가 있어, 테스트는 `npm run build` 후 `node dist/src/server.js`(고정 프로세스)로 진행
    - 테스트용 전화번호가 사용자가 2026-08-05에 직접 만든 실제 테스트 계정(`yongsang0615@gmail.com`)과 우연히 겹쳐 `profiles_phone_key` 충돌 — 그 계정은 그대로 두고 다른 번호로 재시도해 해결
    - 테스트 데이터(가입 계정, emr_patients 2건)와 임시 검증 스크립트 전부 정리 완료

## 현재 작업 중
- 이번 EMR 대작업(`server/` 변경분 + `server_admin/` 신규 + 마이그레이션 006)은 **아직 git commit 전** — `git status`에 `server/src/{lib/errors.ts, routes/auth.routes.ts, services/auth.service.ts, validators/auth.validators.ts}` 수정, `server/db/migrations/006_*.sql`·`server_admin/` 신규(untracked) 대기 중
- 문서(`docs/api-spec.md`/`.html`, `db-schema.md`/`.html`, `server-code-guide.md`/`.html`, `api-user-flow.md`)는 전부 옛날 가입 방식(이름/전화/생년월일 직접 입력) 기준 그대로라 **아직 동기화 안 됨**
- `admin-web` 프론트엔드 자체는 API를 호출하는 실제 화면(환자 등록 폼, 시술기록 입력, "기록" 버튼 등)이 아직 없음 — Vite 기본 스캐폴드 그대로

## 다음 할 일
- (즉시 결정 필요) 문서 4종 동기화 먼저 할지, admin-web 화면 작업으로 넘어갈지 — 사용자 확인 대기 중이었음
- EMR 관련 변경분 git commit (+ push 여부도 함께 확인)
- commit `8a30963`(seed 브랜드명) push 여부도 여전히 미확인
- admin-web에 실제 화면 구현: 환자 등록 폼, 시술기록/이용권 입력, 인증코드 발급 버튼 — `server_admin` API와 연동
- README TODO: Supabase 커스텀 SMTP 연동(Resend/SendGrid), SMS 실연동
- (이월) Render 배포 여부/시점 결정
- (이월) 프론트 담당자 GitHub Collaborator 초대 미발송
- (이월) `.env` 비밀값을 프론트 담당자에게 git 아닌 채널로 전달
- (이월) 위험 신호 키워드 목록(`server/src/lib/riskKeywords.ts`) 전문가(의료진) 검수
- (이월) FCM 실제 발송 스케줄러 트리거 로직 미구현
- (이월) refreshToken 만료 정책 확정 미완료
- (이월) `docs/llm-prompt-design.html`은 여전히 .md 변경사항과 미동기화
- (이월) baseUrl 상수화 가이드를 `frontend-integration-guide.md`에 반영할지 결정
- (이월) `.work-log/dd.txt` 계속 보관할지/삭제할지 — EMR 항목(Tier 5)이 이번 세션으로 사실상 착수/상당 부분 완료됨, 재검토 필요
- (신규) `docs/AAC_클리닉_자산_조사.docx` git 커밋 여부 여전히 미결정(untracked)

## 주요 파일
- `server/db/migrations/006_add_admin_emr_staging_tables.sql` — 가상 EMR 스테이징 4테이블, 적용 완료(untracked)
- `server/src/services/auth.service.ts` — signup()이 patientNo+코드로 emr_patients를 claim, 실제 테이블로 1회성 이관하도록 전면 재작성
- `server/src/validators/auth.validators.ts`, `routes/auth.routes.ts`, `lib/errors.ts` — signup 스키마·에러코드 교체
- `server_admin/` — 신규 관리자 API 서버(포트 4100, 무인증). `src/services/patients.service.ts`가 핵심 로직(환자/시술기록/이용권 CRUD, 인증코드 발급). README에 `server/`와의 관계·알려진 한계 정리해둠
- `admin-web/` — 별도 GitHub 저장소(`WHS-After-Mate/admin-web`) 클론 사본, 이 리포 git에는 미포함(.gitignore 처리). 아직 Vite 기본 스캐폴드
- `server/db/seed/seed.ts` — 4명 데모 고객 시드, 브랜드명 AMRED CLINIC/DERNA CLINIC 실데이터 반영 완료(시술명은 여전히 가상). *EMR claim 플로우와는 무관 — 데모 고객은 seed 스크립트로 직접 계정 생성, patientNo 절차 안 거침*
- `docs/AAC_클리닉_자산_조사.docx` — 사용자 제공 실제 AAC 브랜드 조사 자료(untracked)
- GitHub: https://github.com/WHS-After-Mate/Backend (main, 최신 push `fcb4361` — commit `8a30963`와 이번 EMR 작업 전부 미push)

## 특이사항 / 결정 사항
- **회원가입 방식 전면 변경 배경**: 원래 목표는 "의사가 먼저 입력한 의료 데이터 → 환자가 나중에 정확한 정보로 가입하면 그 데이터 기반 사후케어"였음. placeholder Auth 계정을 미리 만드는 방식은 (1) 진짜 가입 시 별개 계정이 생겨 매칭 안 됨 (2) 기존 `PHONE_ALREADY_EXISTS` 체크가 오히려 가입을 막음 (3) `medical_profiles.user_id`가 PK라 계정 이관 시 PK 스왑이 필요 — 세 가지 문제로 기각. 사용자가 직접 "환자번호+인증코드" 방식을 제안했고, 이게 세 문제를 전부 해결함(계정은 가입 시점에 딱 한 번만 생성, 데이터는 그때 1회 이관)
- **claim은 1회성, 지속 동기화 아님**: claim 이후 emr_* 테이블에 새로 추가한 기록은 앱에 반영 안 됨(의도적 범위 제한). 시도하면 `409 PATIENT_ALREADY_CLAIMED`로 막아 혼란 방지. 실제 서비스라면 배치 ETL이 필요(`db-schema.html`의 "클리닉 EMR 연동" 절이 이미 이 갭을 언급해둔 상태였음)
- **admin-web은 의도적으로 인증 없음**: "데모 버전이라 항상 열려있을 것"이라는 사용자 결정. 실서비스 전환 시 반드시 관리자 인증 추가 필요(README에 명시)
- **Windows tsx watch 재시작 이슈**: 파일 저장 → 자동 재시작 시 이전 프로세스가 포트를 즉시 놓지 않아 `EADDRINUSE`로 전체가 죽는 경우 관찰됨. 로컬에서 안정적으로 띄우려면 `npm run build` 후 `node dist/src/server.js` 권장(빌드 산출물은 `dist/src/server.js`이지 `dist/server.js`가 아님 — `rootDir: "."`라 `src/` 경로가 그대로 보존됨)
- **재발 방지 포인트**: 세션 종료 전 `/기록저장`을 안 하면 다음 세션 자동 브리핑에서 실제로 했던 작업이 누락될 수 있음
- Render 배포 시점 결정은 여전히 보류 상태
- 세션 재시작 시 이 파일이 자동으로 브리핑됨 (글로벌 CLAUDE.md 설정)
