# After School 현재 상태
최종 업데이트: 2026-08-15 19:40

## 프로젝트 개요
WHS After Mate — AAC 웰니스 고객용 관리 이력·이용권 조회, LLM 기반 일차별 사후관리 안내·질문, 다음 관리 추천 MVP(3주 해커톤). 앱 클라이언트는 Android Studio(네이티브 Android), 고객용 백엔드(`server/`)는 Node.js + Express + TypeScript, DB/인증은 Supabase, LLM은 Anthropic Claude API, 푸시는 FCM. 관리자용 웹(`admin-web`, **별도 GitHub 저장소 — 이 백엔드 리포에서는 절대 건드리지 않음, 로컬 클론은 `.gitignore` 처리**)과 그 백엔드(`server_admin/`, 이 리포에 포함)가 추가되어, 실제 클리닉처럼 "환자가 앱 가입 전에 의료진이 먼저 시술 이력을 입력"하는 가상 EMR 구조를 갖췄다. 이번 세션부터 `server_admin`에 클리닉별 관리자 로그인이 생기면서 "admin-web은 무인증 데모"였던 기존 결정이 뒤집혔다.

## 완료된 작업
- **dd.txt 재확인** — 사용자가 업데이트했다고 한 `.work-log/dd.txt`를 실제 코드와 대조. 대부분 이미 완료(전화인증 제거, 비밀번호/이메일 검증, daily-guide 실제 AI 호출, EMR 구조, 의사 이름·관리부위·고객등록 필드 등)였고, 5개 항목(이용권 통합, brand 제거, 회원가입 시 관심목표, 비밀번호찾기 이메일인증, 관리자 인증)만 현재 코드/기존 결정과 다르거나 미반영 상태임을 확인해 사용자에게 제시
- **시술기록↔이용권 통합** — `POST /patients/:id/memberships`(E) 완전 제거. `POST /patients/:id/care-records`(D)가 `membershipId`(기존 이용권에서 1회 차감) 또는 `totalSessions`(직접 입력 — 새 이용권 생성 후 1회차 즉시 소비) 중 하나만 받도록 변경, 응답은 `{ careRecord, membership }`. 이용권 소진 시 `409 MEMBERSHIP_EXHAUSTED`. `emr_memberships.remaining_count` 생성 컬럼 추가(migration 007)
- **careType을 검수된 값만 선택 가능하도록 제약** — `GET /care-types` 신규(reference_guides에 실제 등록된 값만 반환, 현재 `peeling`/`laser_toning` 2개뿐). 목록 밖 값 입력 시 `400 INVALID_CARE_TYPE`으로 거부(전엔 자유 입력 후 daily-guide 조회 시점에야 404 발생). 리프팅류(울쎄라 등)는 아직 검수된 가이드가 없어 이번엔 제외하기로 사용자 확정
- **클리닉 관리자 로그인 신규 도입** — "admin-web은 무인증 데모" 결정을 사용자가 명시적으로 뒤집음. `admin_accounts` 테이블(migration 008) + `POST /auth/login`(bcrypt 비밀번호 검증 + JWT 발급, `server_admin/src/lib/adminAuth.ts`) + `requireAdminAuth` 미들웨어로 `/auth/login` 빼고 전부 로그인 필수화. 시드 스크립트(`server_admin/db/seed/seedAdmins.ts`, `npm run seed:admins`)로 클리닉당 1개씩 3계정 생성: `amred/amred1234`, `derna/derna1234`, `wim/wim1234`(아이디=비밀번호 패턴, 테스트 목적)
- **store 필드 완전 제거 + brand 자동화 + 클리닉별 데이터 격리** — store는 클리닉당 지점이 1곳뿐이라 brand와 항상 1:1이던 중복 정보라 판단해 `care_records`/`emr_care_records`/`admin_accounts`에서 제거(migration 009). `emr_patients.brand` 신규 추가 — 환자 등록·시술기록 추가 시 클라이언트가 brand를 입력하는 게 아니라 로그인한 관리자 토큰에서 그대로 기록됨. 환자 목록/상세/시술기록 추가·삭제/이용권 삭제/인증코드 발급 전부 로그인한 클리닉(`brand`)과 일치하는 데이터만 접근 가능하도록 서비스 레이어에 격리 적용 — 다른 클리닉 데이터는 ID를 직접 넣어도 존재를 숨기기 위해 `404`로 통일(403 아님)
- **레거시 테스트 환자 2명 삭제** — brand 컬럼 추가로 소속 클리닉이 없어 어느 계정으로도 안 보이게 된 예전 테스트 데이터("테스트환자" x2, 그중 1명은 이미 claim된 상태였으나 emr_patients 삭제가 실제 auth.users/profiles엔 영향 없음을 확인 후 삭제) — 사용자 확인 후 삭제
- **`admin-api-example.html` 테스트 페이지 전면 갱신** — 0단계 로그인(클리닉 select+비밀번호) 섹션 신규, 로그인 성공 시 토큰을 A~F 전체 호출에 자동 첨부, "현재 로그인 클리닉" 배너 표시, D의 브랜드/스토어 수동입력 제거, careType을 GET /care-types 기반 select로, 이용권 선택 select 신규. **사용자가 admin-web(별도 저장소) 자체는 계속 건드리지 않기로 재확인 — 이 테스트 페이지에서만 검증 진행**
- 각 단계 실제 서버(4100) 기동 + curl로 실측 검증 완료(로그인 성공/실패, 토큰 없이 401, 다른 클리닉 데이터 격리 확인, 이용권 소진 409 등), `server`/`server_admin` 양쪽 `npm run typecheck`/`build` 전부 통과. 테스트 데이터는 매번 삭제해 정리 완료

## 현재 작업 중
- (없음 — 이번 세션에서 다룬 작업은 전부 실측 검증까지 완료된 상태. **단, git commit은 아직 안 함**)

## 다음 할 일
- **git add/commit/push** — 이번 세션 변경분(migration 007~009, server_admin 대부분, server의 store 제거분) 전부 미커밋 상태. 다음 세션 시작 시 우선 처리
- dd.txt 나머지 미확인 항목 결정 필요:
  - 회원가입 인증을 patientNo+인증코드 대신 patientNo+이름+생년월일로 바꿀지 (항목 4)
  - 회원가입 단계에 관심목표 선택을 다시 넣을지, 지금처럼 가입 후 프로필에서만 유지할지 (항목 5)
  - 비밀번호 찾기를 이메일 링크 대신 숫자 인증코드 입력 방식으로 바꿀지 (항목 7)
- 문서 동기화 미완료 — `docs/api-spec.md`/`.html`, `docs/db-schema.md`/`.html` 등이 이번 세션 변경분(이용권 통합 D/E API 변경, careType 제약, 관리자 로그인, store 제거, brand 격리)을 아직 반영 안 함. 다음 세션에서 동기화 필요
- admin-web에 실제 로그인 화면 구현 — 이번 세션에서 명시적으로 범위 밖으로 재확인됨("우리가 만든 테스트 웹에서만 진행"), 필요 시 별도로 명확히 지시받을 것
- README TODO: Supabase 커스텀 SMTP 연동(Resend/SendGrid), SMS 실연동
- 가비아 클라우드 배포 — 크레딧 지급 조건 확인 후 진행 예정(아직 착수 전)
- (이월) 프론트 담당자 GitHub Collaborator 초대 미발송
- (이월) `.env` 비밀값을 프론트 담당자에게 git 아닌 채널로 전달
- (이월) 위험 신호 키워드 목록(`server/src/lib/riskKeywords.ts`) 전문가(의료진) 검수
- (이월) FCM 실제 발송 스케줄러 트리거 로직 미구현
- (이월) refreshToken 만료 정책 확정 미완료
- (이월) `docs/llm-prompt-design.html`은 여전히 .md 변경사항과 미동기화
- (이월) `docs/AAC_클리닉_자산_조사.docx` git 커밋 여부 여전히 미결정(untracked)

## 주요 파일
- `server/db/migrations/007_emr_membership_remaining_count.sql` — `emr_memberships.remaining_count` 생성 컬럼, 적용 완료
- `server/db/migrations/008_add_admin_accounts.sql` — `admin_accounts` 테이블(클리닉 로그인 계정), 적용 완료
- `server/db/migrations/009_drop_store_add_patient_brand.sql` — store 컬럼 제거 + `emr_patients.brand` 추가, 적용 완료
- `server_admin/src/lib/adminAuth.ts` — bcrypt 해시/검증 + JWT 발급/검증
- `server_admin/src/middleware/requireAdminAuth.ts` — 로그인 토큰 필수화 미들웨어, `req.admin`에 `{adminId, username, brand}` 주입
- `server_admin/src/services/patients.service.ts` — 환자/시술기록/이용권 전체 로직. brand 파라미터로 클리닉 격리, membershipId/totalSessions 분기, careType 검증
- `server_admin/db/seed/seedAdmins.ts` — 클리닉 3계정 시드(`npm run seed:admins`)
- `server_admin/src/examples/admin-api-example.html` — 로그인 포함 A~G 전체 연쇄 테스트 페이지(admin-web 아님)
- `server/src/services/auth.service.ts` — signup() claim 로직(store 제거됨)
- `server/src/services/careRecords.service.ts` — 고객용 시술기록 조회(store 제거됨)
- `admin-web/` — **별도 GitHub 저장소, 이 리포와 무관.** 이번 세션에도 명시적으로 손대지 않음
- GitHub: https://github.com/WHS-After-Mate/Backend (main, 최신 push는 여전히 `e97b208` — 이번 세션 변경분은 전부 미커밋)

## 특이사항 / 결정 사항
- **admin-web(제품)의 "무인증 데모" 결정을 이번 세션에서 뒤집음** — 클리닉별 로그인 계정(3개)을 도입하기로 사용자가 명시적으로 결정. 이유: brand를 관리자가 수동 입력하게 하면 실수로 다른 클리닉을 고를 위험이 있어, 로그인 계정 자체로 brand를 고정하는 게 더 안전하다고 판단
- **store 필드는 순수 중복이라 제거** — 지금 데이터상 클리닉(brand) 하나당 지점(store)이 항상 1곳이라 별도 컬럼의 의미가 없었음(사용자 지적으로 확인)
- **클리닉 데이터 격리는 404로 통일(403 아님)** — 다른 클리닉 소유 리소스는 "존재하지만 권한 없음"이 아니라 "애초에 존재하지 않는 것처럼" 응답해 다른 클리닉 데이터의 존재 자체를 추측하지 못하게 함
- **레거시 테스트 환자 2명 삭제** — brand 미지정으로 고아가 된 예전 테스트 데이터, 사용자 확인 후 삭제(그중 1명은 claim 완료 상태였으나 emr_patients 삭제가 실제 앱 계정에 영향 없음을 확인함)
- **admin-web(별도 저장소)은 여전히 범위 밖** — 이번 세션 중 사용자가 "관리자 페이지 수정해서 로그인하자"고 했다가, 확인 질문 후 "아니오, 백엔드만 계속 / 우리가 만든 테스트 웹에서만 진행"으로 명확히 재확인. 즉 admin-web 실제 화면 구현은 여전히 이 백엔드 세션 범위 밖
- **admin-web(제품 자체) 로그인 없음 결정은 이제 무효화됨** — 이전 work-log에 "admin-web은 데모라 항상 열려있을 것"이라 적혀 있었으나 이번 세션 결정으로 대체됨(관리자 로그인 추가)
- **Windows tsx watch 재시작 이슈** — 여전히 유효, `npm run build` 후 `node dist/src/server.js` 권장
- **배포처를 Render에서 가비아 클라우드로 변경**하기로 한 이전 결정은 유효, 아직 착수 전
- 세션 재시작 시 이 파일이 자동으로 브리핑됨(글로벌 CLAUDE.md 설정)
