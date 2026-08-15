## 2026-08-15
- admin-web 리포 업데이트 여부 확인 요청 → `git fetch`/`git log HEAD..origin/main`으로 새 커밋 없음(여전히 `initial commit` 하나뿐) 확인해 답변
- 사용자가 `.work-log/dd.txt`에 피드백을 업데이트했다고 해서 확인 → 실제 코드와 항목별로 대조. 대부분 이미 Tier 0~5에서 완료됐고, 5개 항목만 현재 코드/기존 결정과 다르거나 미반영임을 정리해 제시(이용권 처리, brand 제거, 회원가입 관심목표, 비밀번호찾기, 관리자 인증)
- **1번(이용권↔시술기록 통합)** — 사용자가 "환자가 가진 이용권을 토글 목록으로 보여주고 선택 시 차감, 없으면 직접입력으로 새 이용권 생성" 흐름을 구체적으로 설명 → 확인 질문(직접입력이 새 이용권도 만드는지, 기존 이용권 추가 API를 없앨지) 거쳐 설계 확정
  - `POST /patients/:id/memberships`(E) 완전 제거, `POST /patients/:id/care-records`(D)가 `membershipId`(기존 차감) 또는 `totalSessions`(직접입력 — 새 이용권 생성+1회차 즉시 소비) 중 하나만 받도록 재설계, 응답 `{ careRecord, membership }`로 변경
  - `emr_memberships.remaining_count` 생성 컬럼 추가(`007_emr_membership_remaining_count.sql`) — 실제 `memberships` 테이블과 동일 패턴
  - `errors.ts`에 `membershipExhausted`(409) 추가, `admin-api-example.html` D/E 섹션을 이용권 select+직접입력 필드로 갱신
  - 서버 실기동 + curl로 1/2/3회차 정상 차감, 4회차 시도 시 409, 옛 E엔드포인트 404, 두 필드 동시입력 400까지 검증. typecheck/build 통과
- 사용자가 careType의 정체(피부클리닉에 실제 있는 개념인지) 질문 → 이 프로젝트가 daily-guide 매칭용으로 자체 도입한 내부 분류값이며 실제 EMR 표준 필드가 아님을 설명
- 사용자가 "careType을 자유입력 대신 정해진 목록 중 택1로 하는 게 낫겠다" 제안 → `GET /care-types` 신규(reference_guides에 실제 검수 등록된 값만 반환), `POST .../care-records`가 목록 밖 값이면 `400 INVALID_CARE_TYPE`으로 거부하도록 변경. 테스트 페이지 careType을 자유입력 → select로 교체. 리프팅류 미지원 상태임을 사용자에게 알림 → 사용자가 "리프팅류는 일단 빼고 peeling/laser_toning만 우선 지원"으로 확정(추가 코드 변경 불필요)
- **2번(brand 필드 제거) 논의** — 사용자가 "관리자 웹에 클리닉별 로그인 계정 3개를 만들고, 로그인하면 brand가 자동으로 채워지고 시술기록에도 자동 반영되는 구조"를 제안 → 기존 "admin-web은 무인증 데모" 결정을 뒤집는 큰 변경이라 확인 질문(데이터 공개 범위/계정 발급 방식/store 자동화 여부) 거쳐 설계 확정: 클리닉별 완전 격리, 시드 스크립트로 3계정 고정 생성, store도 계정에서 자동
  - 사용자가 "우선 로그인 계정부터 만들자, 테스트 목적이니 확실히 알 수 있게" 요청 → 1단계로 로그인만 구현
  - `admin_accounts` 테이블(`008_add_admin_accounts.sql`), bcrypt+jsonwebtoken 신규 도입, `server_admin/src/lib/adminAuth.ts`(해시/JWT), `POST /auth/login`, `server_admin/db/seed/seedAdmins.ts`(클리닉당 1계정 — `amred/amred1234`, `derna/derna1234`, `wim/wim1234`). `ADMIN_JWT_SECRET`은 로컬 `.env`에 임의값으로 채움
  - 서버 실기동 + 3계정 전부 로그인 성공(각자 brand 정확히 반환), 오답 비밀번호 401 확인. typecheck/build 통과
- 사용자가 "관리자 페이지 수정해서 로그인 단계부터 해보자"고 해서 admin-web(별도 저장소) 수정 여부를 재확인 질문 → 사용자가 "아니오, 백엔드만" "우리가 만든 테스트 웹에서만 진행"으로 명확히 재확인 — 기존 "admin-web 건드리지 않는다" 원칙 그대로 유지
- **`/patients/*` 로그인 필수화** — `requireAdminAuth` 미들웨어 신규(`/auth/login` 제외 전부 토큰 필수), `admin-api-example.html`에 0단계 로그인 섹션 추가해 로그인 성공 시 토큰을 A~F 전체 호출에 자동 첨부하도록 갱신. 토큰 없이 401, 로그인 후 200 실측 확인
- 사용자가 "brand/store 중 store는 클리닉당 지점이 하나뿐이라 없어도 되지 않냐" 질문 → 동의, store 전면 제거로 스코프 확장
  - `care_records`/`emr_care_records`/`admin_accounts`에서 `store` 컬럼 삭제, `emr_patients.brand` 신규 추가(`009_drop_store_add_patient_brand.sql`)
  - 시술기록 추가 시 `brand`도 클라이언트 입력 제거하고 로그인 토큰에서 자동 기록, 환자 등록도 동일
  - `patients.service.ts` 전면 개편 — 환자 조회/목록/시술기록/이용권/인증코드 전부 로그인한 클리닉의 brand와 일치할 때만 접근 가능(다른 클리닉 데이터는 404로 통일, 존재 자체를 숨김)
  - `server/`(고객용) 쪽 `auth.service.ts`(claim 로직)·`careRecords.service.ts`·`seed.ts`에서도 store 참조 제거
  - 서버 실기동 + curl로 amred 로그인→환자 등록(brand 자동 "AMRED CLINIC")→amred 목록엔 보임→**derna 로그인 시 목록 비어있음, ID 직접조회 404**→amred가 시술기록 추가(brand 자동, 정상 차감)→**derna가 같은 환자에 쓰기 시도 시 404**까지 전부 검증. 양쪽 서버 typecheck/build 통과
- brand 추가로 소속 클리닉이 없어진 레거시 테스트 환자 2명(모두 "테스트환자", 그중 1명은 이미 claim 완료 상태)을 발견 → 사용자 확인 후 삭제(claim된 계정 자체는 별개 테이블이라 영향 없음을 확인)
- 이번 세션 내내 서버 종료 시 매번 `netstat`으로 포트별 정확한 PID를 찾아 `taskkill /PID`로만 종료(세션 초반 한 번 `taskkill /IM node.exe`로 전체 node 프로세스를 죽인 적이 있어 이후 교정)
- git commit은 아직 안 함 — `/기록저장`으로 세션 정리

## 2026-08-13
- 사용자가 `https://github.com/WHS-After-Mate/admin-web.git`(관리자 홈페이지 예시 리포)을 알려줘 로컬 `admin-web/`로 클론 — commit 1개("initial commit")뿐인 React 19+Vite 8 기본 스캐폴드, 실제 화면 없음을 확인
- admin-web의 목적 확인: 실제 클리닉 데스크처럼 환자 프로필(이름/생년월일/전화번호)과 시술 이력(피부 클리닉 시술 횟수 등)을 직접 입력하는 가상 EMR 데이터 입력 도구. API는 별도 `server_admin`으로 분리 요청받음
- **아키텍처 논의** — "이미 가입된 계정 위에 EMR을 얹는 방식"(1안)의 문제를 짚음: placeholder Auth 계정을 미리 만들면 (1) 나중에 진짜 가입 시 별개 계정이 생겨 매칭 안 됨 (2) 기존 `PHONE_ALREADY_EXISTS` 체크가 오히려 진짜 가입을 막음 (3) `medical_profiles.user_id`가 PK라 이관 시 PK 스왑 필요 — 세 가지 실질적 문제로 그대로는 어렵다고 설명
- 사용자가 "환자번호 + 24시간 유효 인증코드로 신원확인 후 가입" 방식을 역제안 → 위 세 문제를 전부 해결하는 더 나은 설계임을 확인하고 채택. "환자번호 없으면 가입 자체를 막는다", "admin-web은 인증 없이 항상 열어둔다"로 범위 확정
- **구현**
  - `server/db/migrations/006_add_admin_emr_staging_tables.sql` — `emr_patients`/`emr_care_records`/`emr_memberships`/`signup_verification_codes` 4개 테이블, `auth.users`와 무관하게 독립 존재. 사용자가 Supabase SQL Editor에서 즉시 적용
  - `server_admin/` 신규 서버(포트 4100) — `server/`와 동일 컨벤션(Express+TS+zod, routes/services/validators 3단 구조)으로 처음부터 구축. 환자 등록/목록/상세/수정, 시술기록·이용권 추가/삭제, 인증코드 발급(24시간 유효, 실제 SMS 미발송 — 응답에 코드 그대로 노출해 admin-web 화면 표시용) API 구현. 로그인 없음(요청대로)
  - `server/src/services/auth.service.ts`의 `signup()` 전면 재작성 — `{email,password,name,phone,birthDate}` → `{patientNo,verificationCode,email,password}`로 시그니처 변경, emr_patients에서 이름/생년월일/전화번호를 가져와 profiles 생성 + medical_profiles/care_records/memberships를 1회성 이관(claim) + 인증코드 사용 처리 + emr_patients.claimed_user_id 기록. 실패 시 생성된 Auth 유저 롤백(CASCADE로 하위 테이블 자동 정리)
  - `lib/errors.ts`: `phoneAlreadyExists` 제거, `patientNotFound`/`patientAlreadyClaimed`/`invalidOrExpiredVerificationCode` 추가
  - `npm run typecheck`/`build` 양쪽 서버 모두 통과
- **엔드투엔드 실측 테스트** — 두 서버(4000/4100)를 실제로 띄워 환자 등록→시술기록·이용권 추가→인증코드 발급→그 코드로 `/auth/signup`→`GET /profile`·`/care-records`·`/memberships`로 이관 데이터 확인→같은 환자번호 재가입 시도 시 `409 PATIENT_ALREADY_CLAIMED` 확인까지 전체 흐름 통과
  - 과정에서 두 가지 이슈 발견/해결: ① Windows `tsx watch`가 파일 저장 후 재시작할 때 `EADDRINUSE`로 프로세스가 죽는 경우가 있어 `npm run build` + `node dist/src/server.js`(고정 프로세스)로 전환해 해결 ② 테스트용 전화번호가 사용자가 2026-08-05에 만들어둔 실제 테스트 계정과 우연히 겹쳐 `profiles_phone_key` 충돌 — 그 계정은 건드리지 않고 다른 번호로 재시도
  - 테스트로 만든 가입 계정 1개 + emr_patients 2건 + 임시 검증 스크립트 전부 정리(삭제) 완료
- git commit은 아직 안 함(문서 동기화 여부를 먼저 사용자에게 확인 중이었음) — `/기록저장`으로 세션 정리
- **신규 세션 — 문서 4종 동기화**: `docs/api-spec.md`/`.html`(v0.5→v0.6), `db-schema.md`/`.html`(v0.3→v0.4), `server-code-guide.md`/`.html`(v0.1→v0.2), `api-user-flow.html` 전부 환자번호+인증코드 기반 가입(가상 EMR) 흐름으로 갱신 — signup 요청/에러 스키마, EMR 스테이징 4테이블 ERD·정의, signup() 로직 설명, 플로우 다이어그램 SIGNUP 노드까지 반영
- 문서 아티팩트 4종(api-spec/db-schema/server-code-guide/api-user-flow) claude.ai에 재발행 — 기존 발행 URL 그대로 유지, WebFetch로 최신본 확인 후 갱신
- **EMR 관련 변경분 git commit + push 완료** — `server/` 수정분 + `server_admin/` 신규 + 마이그레이션 006 + 문서 4종을 한 커밋으로 정리(`be86a01`, "Replace signup with patient-number + verification-code flow (virtual EMR)"), `8a30963`(seed 브랜드명)와 함께 origin/main에 push(`fcb4361..be86a01`)
- 사용자가 `admin-web` 저장소는 이 백엔드 세션에서 절대 건드리지 않는다는 점을 명시적으로 재확인 — `git show --stat`으로 이번 커밋에 admin-web 관련 파일 변경이 0건임을 검증해 답변
- work-log 정리 — `/기록저장`으로 저장
- **`server_admin` API 테스트 페이지 신규 제작** — `server_admin/src/examples/admin-api-example.html`(`api-call-example.html`과 동일한 fetch 기반 방식). 환자 등록(A)→목록/상세 조회(B, C)→시술기록/이용권 추가·삭제(D, E)→인증코드 발급(F)→그 코드로 고객용 `server`에 실제 회원가입(G)까지 한 페이지에서 연쇄 테스트 가능. patientId(UUID)/patientNo 헷갈리는 지점, "어느 환자가 대상인지 안 보인다"는 사용자 피드백 반영해 "현재 대상 환자" 공용 섹션으로 재구성
- 서버 2개(4000/4100)를 실제로 띄워 새 예시 페이지가 하는 동작을 curl로 재현해 A→G 전체 흐름 재검증(claim 데이터 확인, 재가입 시 `409 PATIENT_ALREADY_CLAIMED` 확인) — 테스트 데이터는 서비스 role key 임시 스크립트로 정리, 스크립트 삭제, 서버 종료
- `server/src/examples/api-call-example.html`의 A단계(회원가입)를 옛날 이메일/이름/전화/생년월일 폼에서 새 `patientNo`+`verificationCode` 폼으로 갱신 — EMR 전환 이후로는 실패하는 요청이었음을 사용자가 지적해 발견
- 사용자 UX 피드백 반영: 생년월일/시술일 입력을 `type="date"`로(수동 대시 입력 오류 방지), 전화번호 입력에 실시간 숫자 필터 추가
- 그 과정에서 사용자가 "전화번호 형식 제한은 API 영역 아니냐"고 질문 → 확인해보니 실제로 `server_admin`의 `createPatientSchema`/`updatePatientSchema`가 `phone: z.string().min(1)`로 형식 검증을 전혀 안 하고 있었음(프론트 필터는 겉치레였음)을 인정, `phone: /^\d{9,11}$/` 정규식으로 실제 API 레벨 검증 추가
- 사용자와 회원가입/인증 설계 문답: (1) 인증코드는 최초 신원확인 1회용, 이메일/비밀번호가 이후 로그인+비밀번호 찾기 수단이라는 이해 확인 (2) G단계에 patientNo가 별도로 필요한 이유 설명 — `signup_verification_codes.code`는 전역 유일값이 아니라(6자리 랜덤, unique 제약 없음) patientNo로 먼저 환자 1명을 좁혀야 코드 충돌/브루트포스 위험이 없음(계좌번호+OTP와 동일한 2단계 구조)
- git commit + push 완료 — `e97b208`("Add server_admin API test page, enforce phone format, sync signup example")
- 사용자가 `api-spec.md` 최신화 여부 질문 → `git log be86a01..HEAD`로 `server/`(고객용) API 계약에 영향 주는 변경이 없었음을 확인해 "최신 상태" 확인 답변(전화번호 검증 강화는 `server_admin` 범위라 문서화 대상 아님)
- 사용자가 "가비아 서버가 뭐냐, 해커톤에서 무료 토큰 준다는데" 질문 → WebSearch로 가비아 클라우드(한국 도메인/호스팅 업체의 클라우드 VM 서비스, Render와 같은 역할) 설명. 해커톤 전용 크레딧 조건은 일반 검색으로 확인 불가(가비아 공식 신규고객 대상 "30만원 크레딧" 이벤트만 확인), 해커톤 주최 측 안내 재확인 필요
- **배포 계획을 Render → 가비아 클라우드로 변경**(사용자 결정) — 아직 크레딧 지급 조건·가비아 VM 배포 절차 둘 다 미착수, work-log에 반영
- work-log 정리 — `/기록저장`으로 저장

## 2026-08-12
- Tier 2 커밋(`501a268`) push 완료 — `WHS-After-Mate/Backend` main에 반영(`3b2ef51..501a268`)
- **Tier 3 착수** — `/notifications/settings` 알림설정 단순화 논의
  - `pushEnabled`/`aftercareReminder`/`membershipExpiryAlert`/`marketingAlert` 4개 값을 코드로 추적한 결과, DB에 저장만 될 뿐 어디서도 실제로 읽어 분기하지 않는 순수 placeholder였음을 확인(`push.service.ts`의 `sendPushToUser`도 이 값들을 체크하지 않고, 발송 스케줄러 자체가 없음)
  - 사용자 확인으로 "완전 제거"로 범위 확정(단순 축소가 아니라 GET/PATCH 엔드포인트 자체 삭제)
  - `notifications.routes.ts`/`notifications.service.ts`에서 settings 조회/수정 라우트·서비스·타입 전부 삭제, `profile.validators.ts`의 `updateNotificationSettingsSchema` 삭제, `push.service.ts` 주석 정리 — device-token 등록/해제는 실제로 쓰이므로 그대로 유지
  - 신규 마이그레이션 `005_remove_notification_settings.sql` 작성(`profiles`의 4개 컬럼 삭제) — 아직 Supabase 미적용
  - `npm run typecheck`/`npm run build` 통과 확인
  - 문서 동기화: `docs/api-spec.md`/`.html`(엔드포인트 요약·상세·데이터모델·미확정사항·v0.5 이력 테이블), `docs/db-schema.md`/`.html`(CREATE TABLE·컬럼표·ERD mermaid·설계결정 카드·신규 "알림 설정 제거(005)" 절 추가), `docs/server-code-guide.md`/`.html`, `docs/api-user-flow.html`(mermaid NOTIF/NOTIFUPDATE 노드·엣지·스텝 테이블 15행 삭제), 루트 `README.md`·`server/README.md`
  - git commit/push 완료 — `fcb4361` (`501a268..fcb4361`)
- Tier 5(EMR)를 제외한 dd.txt 요구사항 전부 완료 확인. 남은 결정 사항 두 가지 제시 — 마이그레이션 005 Supabase 적용 여부, 수정된 문서 4종의 아티팩트 재발행 여부(사용자 확인 대기)
- work-log 최종 정리 — `/기록저장`으로 저장
- **신규 세션 — 마이그레이션 005 적용**: 사용자가 Supabase SQL Editor에서 직접 실행 → service role key로 `profiles`의 4개 컬럼(`push_enabled`/`aftercare_reminder`/`membership_expiry_alert`/`marketing_alert`) 조회하는 임시 스크립트로 전부 삭제됨 확인, 스크립트는 확인 후 삭제
- **문서 아티팩트 4종 재발행** — api-spec/db-schema/server-code-guide/api-user-flow를 Tier 3(알림설정 제거) 반영된 최신 로컬 `.html`로 재발행. 재발행 과정에서 "API 명세서" 아티팩트가 2개(중복) 존재함을 발견 — 최신본(`5cf6ed55...`)에 재발행하고, 2026-08-05 이후 갱신 안 된 구버전(`5462bb46...`, 전화인증 SMS 흐름 잔존)은 그대로 둠. Artifact 도구엔 삭제 기능이 없어(publish/list만 지원) 사용자가 claude.ai/code/artifacts에서 직접 삭제 완료
- **Tier 2 후속 — seed.ts 실제 AAC 브랜드명 반영**: `AAC_클리닉_자산_조사.docx`를 python-docx로 재추출해 확인 — 가상 브랜드 `"AAC 청담"`→`"AMRED CLINIC"`(청담 소재 하이엔드 리프팅 전문), `"AAC 강남"`→`"DERNA CLINIC"`(웰니스하우스서울 B1, 대중형 라인)로 교체(홍길동·이서준의 청담 시술 3건, 김민지의 강남 시술 1건 · store 값도 각각 갱신). 시술명·담당의·care_type은 이번 범위(브랜드명만) 밖이라 유지, WIM Clinic/Center는 이번 시드에 미사용. `docs/api-spec.md`/`.html` 예시 JSON도 동기화. `npm run typecheck` 통과, `npm run seed` 재실행 후 `care_records.brand/store` 직접 조회로 실제 반영 확인(검증 스크립트는 확인 후 삭제), api-spec 아티팩트 재발행
- git commit 완료 — `8a30963` (seed.ts 브랜드명 교체 + api-spec.md/.html 예시 JSON 동기화 + work-log). 아직 push는 안 함(사용자 확인 대기)
- work-log 최종 정리 — `/기록저장`으로 저장

## 2026-08-11
- 세션 시작, work-log 브리핑 후 실제 git 상태 재확인 — 08-05 저녁분이 여전히(6일째) 미커밋 상태임을 확인
- 신규 untracked `.work-log/dd.txt` 발견(사용자가 남긴 다음 요구사항 메모) — 사용자 확인으로 정식 변경사항임을 확정, Tier 0~5로 우선순위 정리
- `/aftercare/questions`가 진짜 LLM(AI API)을 쓰는지 재확인 요청 → `llm/client.ts`의 `callStructuredLlm`이 실제 `anthropic.messages.create`를 호출함을 코드로 검증
- `server/src/examples/api-call-example.html`에 D(사후관리 질문 테스트) 섹션 추가, accessToken을 공용 변수로 리팩터링
- `docs/api-spec.md`/`.html`의 "LLM 기반" 표현에 "실제 Anthropic Claude API 호출, 하드코딩 아님" 설명 추가, 아티팩트 재발행
- Tier 0(08-05 저녁분 + 08-11 오늘분) commit/push 완료 — `7e62ddf` (`9eb1af2..7e62ddf`)
- work-log(`current.md`/`progress.md`) 1차 정리 — `/기록저장`으로 저장
- **Tier 1 착수 및 완료** — 전화번호 SMS 인증 기능 전체 제거 + 회원가입 생년월일 필드 추가
  - `auth.routes.ts`/`auth.validators.ts`/`auth.service.ts`에서 `verify-phone/request`·`/confirm`·`phoneVerifiedToken` 관련 코드 전부 삭제, `signup()`을 토큰검증 없는 단순 가입으로 변경 + `birthDate` 파라미터 추가
  - `lib/otp.ts`/`lib/sms.ts`/`lib/signedToken.ts` 삭제(다른 곳에서 미사용 확인 후), `errors.ts` 관련 에러 6종 삭제 + `phoneAlreadyExists` 추가, `env.ts`/`.env.example`에서 `APP_TOKEN_SECRET`/`SMS_*` 제거
  - 비밀번호 8자 이상·이메일 형식 검증은 이미 구현돼 있었음을 확인(추가 작업 불필요)
  - 신규 마이그레이션 `004_remove_phone_verification.sql` 작성(`phone_verifications` 테이블 + `profiles.phone_verified_at` 컬럼 삭제), `seed.ts` 갱신
  - `npm run typecheck` 통과 확인
  - `api-call-example.html` A섹션 3단계 SMS 플로우 → 단일 가입 버튼으로 축소
  - `docs/api-spec.md`/`.html`, `server/README.md`, `docs/db-schema.md`/`.html`, `docs/server-code-guide.md`/`.html`, `docs/api-user-flow.html`, `docs/frontend-integration-guide.md`/`.html` 전부 동기화, 아티팩트 5개 재발행
  - git commit/push 완료 — `3b2ef51` (`7e62ddf..3b2ef51`)
- 마이그레이션 004를 사용자가 Supabase SQL Editor에서 직접 실행 → `phone_verifications` 테이블·`profiles.phone_verified_at` 컬럼이 실제로 삭제됐는지 service role key로 조회하는 임시 스크립트로 검증(둘 다 존재하지 않음 확인), 스크립트는 확인 후 삭제 — Tier 0·Tier 1 전체 완료
- work-log 최종 정리 — `/기록저장`으로 저장, 다음 세션은 Tier 2부터
- **Tier 2 착수** — `interestGoals`를 다음 시술 추천 로직에 반영하는 작업 재개
  - 조사 결과: 추천은 LLM이 아니라 `recommendations.service.ts`의 규칙 기반 로직이며, `interestGoals`는 이미 매칭에 쓰이고 있었으나 `goal.slice(0, 2))`(앞 2글자만 비교)라 "미백" 같은 단어가 "브라이트닝 필링"과 매칭 안 되는 등 부정확했음
  - 사용자가 `docs/AAC_클리닉_자산_조사.docx`(python-docx로 텍스트 추출) 제공 — 실제 AAC(주식회사 에이에이씨) 회사 정보: AMRED CLINIC(청담, 하이엔드 리프팅 — 울쎄라·써마지·튠페이스·튠라이트)/DERNA CLINIC(대중형, EVE랩 AI 진단)/WIM Clinic·Center(메디컬 웰니스) 3개 브랜드 + 웰니스하우스서울(WHS) 공간 구조 확인
  - 사용자 확인으로 작업 범위를 "추천 로직 개선만"으로 한정(브랜드명/시술명 실제 데이터 교체는 별도 작업으로 분리, seed.ts는 이번엔 미변경)
  - `recommendations.service.ts`: 기존 `POPULAR_TAG_RULES`(관리명→태그, "비슷한 고객이 자주 찾는 관리" 칩 전용)를 `KEYWORD_GROUPS`(태그↔키워드 양방향)로 일반화해 `tagsFor()` 헬퍼 신설, `popularTagsFor()`가 이를 재사용하도록 리팩터링
  - `computeNextCareRecommendation()`의 `interestGoals` 매칭을 `name.includes(goal.slice(0, 2))` → `tagsFor(name)`/`tagsFor(goal)` 태그 교집합 비교로 교체 — 관리명 표기가 관심 목표 어휘와 달라도(동의어 그룹 매칭) 정확히 매칭되도록 개선
  - `npm run typecheck` 통과 확인
  - `docs/server-code-guide.md`의 `POPULAR_TAG_RULES` 참조를 `KEYWORD_GROUPS`로 동기화(`.html`은 상수명 직접 언급 없어 수정 불필요)
  - 아직 git commit 안 함

## 2026-08-06
- 새 세션 시작, `.work-log/current.md` 브리핑 후 사용자 요청으로 실제 git 상태(diff/status) 재확인
- 미커밋 변경 3건 발견: `auth.service.ts`(비밀번호 재설정 로직), `docs/api-spec.md`, `server/README.md` 수정 + `server/src/examples/api-call-example.html` 신규 파일 — work-log(00:34 저장)와 마지막 커밋(17:23)엔 반영 안 됨
- `api-call-example.html` 내용 확인 — 프론트(Android) 담당자용 fetch 기반 API 수동 테스트 페이지(회원가입/로그인/비밀번호찾기 3시나리오, 초보자 주석 포함)임을 파악
- 파일 mtime(08-05 21:25~21:39)이 마지막 커밋(17:23)·work-log 저장(00:34) 이후임을 대조해, "08-05 저녁 세션에서 실제 작업했으나 `/기록저장` 없이 종료돼 기록 누락"으로 결론 — 사용자 확인으로 검증됨
- `.work-log/current.md`를 08-05 저녁 작업 내역 기준으로 소급 갱신, `progress.md`에 08-05 (2) 항목 추가

## 2026-08-05 (2)
- (당시 미기록, 08-06에 소급 정리) **비밀번호 재설정 버그 수정** — `confirmPasswordReset`이 Supabase `token_hash`/`verifyOtp` 방식을 가정했으나, 기본 "Reset Password" 메일 템플릿은 이미 검증된 `access_token`을 URL 해시로 전달하는 방식임을 실사용 링크로 실측 확인 → `getUser(recoveryToken)` 기반 검증으로 교체, 세션 무효화 로직도 함께 수정
- `requestPasswordReset`에 Supabase 에러 콘솔 로깅 추가
- `docs/api-spec.md`/`server/README.md` 동기화 — `recoveryToken`이 `access_token`임을 명시, SMS 미구현/개발모드 설명 보강, "TODO — 프로덕션 전 처리 필요"(Supabase 커스텀 SMTP 연동, SMS 실연동) 섹션 신규 추가
- 신규 파일 `server/src/examples/api-call-example.html` 제작 — 프론트(Android) 담당자가 브라우저에서 직접 눌러볼 수 있는 fetch 기반 API 테스트 페이지(회원가입 3단계/로그인+홈조회/비밀번호찾기), 초보자용 상세 주석 포함
- 이 세션 변경사항은 `/기록저장` 없이 종료되어 git commit/push 및 work-log 반영 모두 안 된 채로 다음날(08-06)까지 남아있었음

## 2026-08-05
- 세션 대부분 개념 설명(Express 서버 구조, 클라이언트-서버 아키텍처, localhost/LAN/에뮬레이터 주소 차이) Q&A — 코드 변경 없음
  - `app.ts`(설계도) vs `server.ts`(`app.listen()`으로 실제 실행) 구조, "코드를 앱에서 import해서 못 쓰는 이유"(런타임 차이 + 비밀키/신뢰/배포 문제), 안드로이드가 Retrofit으로 API 호출하는 실제 코드 예시 등 설명
- 신규 문서 `docs/frontend-integration-guide.md` + `.html` 작성 — 프론트(Android) 담당자가 리포 clone → `.env` 설정 → 서버 실행 → baseUrl(에뮬레이터/실기기) → 데모 계정 → Retrofit 연동까지 따라할 수 있는 절차 문서, 기존 docs와 동일 디자인 시스템으로 `.html` 제작
- README.md 문서 인덱스에 신규 문서 항목 추가
- `docs/frontend-integration-guide.html`을 Claude 아티팩트로 신규 발행 (favicon 📱)
- Render 배포 시점 재논의 — "지금 배포하는 게 더 편할 것 같다"는 사용자 의견에 장단점(고정 HTTPS 주소 vs 재배포 필요/콜드스타트) 설명 → **결정은 내일로 보류**
- baseUrl 주소 바뀔 때마다 여러 곳 다 고쳐야 하는지 질문 → 상수 분리(`ApiConfig`) / `buildConfigField`로 debug·release 자동 전환하는 방법 코드로 제안
- 사용자가 짠 Retrofit 예시(`interface WhsApi` / `Retrofit.Builder()` / `retrofit.create()`)를 한 줄씩 설명 — interface는 선언만 있는 명세, Builder는 통신 클라이언트 생성(Supabase `createClient`와 동일 역할로 비유), `create()`는 명세를 실제 구현체로 런타임 자동 생성하는 Retrofit 고유 메커니즘. **"내일 다시 물어볼게"로 보류**
- 이번 세션 변경사항(README.md + 신규 문서 2개)은 아직 git commit/push 안 됨

## 2026-08-04 (2)
- GitHub 리포(`WHS-After-Mate/Backend`) private 여부 확인 — `gh` CLI 없어 `curl`로 API 비인증 조회(404) + `git ls-remote`(인증 성공) 대조해 private으로 추정, 사용자가 직접 확인해 private 확정
- Collaborator 초대 방법 안내(Settings > Collaborators and teams > Add people) — 아직 미발송
- "Render를 왜 써야 하냐(DB 때문인지)" 질문에 DB(Supabase)는 이미 클라우드에 있고 Render는 Express 서버를 24시간 켜놓기 위한 것이라고 정정 설명
- "앱인데 서버를 왜 항상 켜놔야 하냐" 질문에 클라이언트-서버 구조가 필요한 이유(공유 의료데이터 DB, LLM API 키 유출 방지, 서버 신뢰 로직) 설명
- 최종 결정: 최종 완료 전까지 로컬호스트로 개발, 최종 완료 시점에 Render로 배포

## 2026-08-04
- Android/프론트 담당자 연동 방식 논의(코드 변경 없는 컨설팅 세션)
- 백엔드 코드를 안드로이드 스튜디오에 "바로 넘겨 쓸 수 있는지" 질문에, server/는 별도 Node 백엔드라 코드 import가 아니라 (1) 접근 가능한 서버 URL (2) API 계약 문서(`docs/api-spec.md`)가 필요하다고 정리
- 서버 접근 방식(로컬 직접 실행/ngrok/클라우드 배포) 중 "프론트 담당자가 리포 clone해서 로컬로 npm run dev" 방식으로 결정 — `.env` 비밀값은 git 아닌 채널로 전달, 같은 Supabase 프로젝트 키 공유 필요, 마이그레이션/시드는 재실행 불필요
- 프론트 담당자가 이미 별도 Android Studio 프로젝트로 작업 중임을 확인 → 백엔드 리포는 그 프로젝트와 별개 폴더로 clone해서 서버만 로컬 실행하는 용도로 정리
- Android Studio 실무 설정(Retrofit/OkHttp, INTERNET 권한, network_security_config cleartext 예외, baseUrl 에뮬레이터/실기기 차이, accessToken Interceptor) 안내
- "`npm run dev`가 앱 실행이냐" 질문에 오해 정정 — 백엔드 서버만 띄우는 것이며, Play Store/APK 배포엔 클라우드 배포(HTTPS 고정 URL)+서명된 APK/AAB 빌드가 별도로 필요함을 설명. 배포 작업 자체는 사용자가 "나중에 하자"고 보류
- 다음 액션으로 GitHub 리포 private 여부 확인 및 프론트 담당자 Collaborator 초대가 남음(미실행)

## 2026-08-03
- 사용자와 EMR 연동 관련 논의: 현재 스키마(`external_record_id`/`source_system`/`synced_at`)는 "동기화된 사본"이라는 표시로는 충분하나 실제 파이프라인엔 부족(환자 매칭 로직/증분 동기화 커서/삭제 반영 정책 없음), 데모 데이터는 100% 가상이며 실제 서비스 전환 시 법적 검토 필요함을 확인
- 임시 검증 스크립트로 Supabase에 시드 데이터 실제 존재 확인(작업 후 삭제)
- `server/db/seed/seed.ts`를 가상 고객 1명 → 4명(`PATIENTS` 배열 + `seedPatient()`)으로 리팩터링 — 정상/이용권 만료임박/이용권 소진/신규고객 4가지 시나리오, `npm run seed`로 실제 반영 확인
- `aftercare.service.ts` 버그 수정 — daily-guide LLM 실패 폴백 시 `doctor_comment`가 사라지던 것을 `basicCare`에 덧붙이도록 수정
- git add/commit/push 완료 — seed 확장 + 폴백 수정 + work-log를 `WHS-After-Mate/Backend` main에 반영 (`d900124..3a97609`)
- 사용자에게 `id` vs `user_id`(소유자 매칭), `reference_guides`가 환자와 분리된 공용 테이블인 이유, 폴백 미반영 개인화 문제(위 버그 수정으로 이어짐) 순차 설명

## 2026-08-02 (2)
- `server/src/routes/*.routes.ts` 8개 파일 전체에 요구사항 매핑 주석 추가 — 각 엔드포인트가 `api-spec.md`의 몇 절·어떤 요구사항 ID(R-USXPEM/R-QGENNK/R-DCDOJF/F-GBZTGO/F-ULCIXA)를 구현하는지와 캐싱·폴백·사전 차단 등 동작을 명시, 타입체크 통과 확인
- 신규 문서 `docs/server-code-guide.md`(+ `.html`) 작성 — api-spec 등 기존 문서가 API 계약을 설명한다면 이 문서는 `server/src` 코드 자체의 동작(레이어 구조/요청 파이프라인/인증 흐름/LLM 파이프라인 단계별 흐름/파일별 역할/문서-코드 차이 표)을 설명. html은 기존 docs 3종과 동일한 디자인 시스템으로 제작
- 루트 `README.md` 문서 인덱스에 신규 문서 항목 추가
- `docs/server-code-guide.html`을 Claude 아티팩트로 신규 발행 (favicon 🧩)
- 사용자에게 `app.ts`/`routes/index.ts`/`auth.routes.ts` 기반으로 Express 기초(미들웨어 체인, `app.use` 등록순서, 경로 prefix 벗기기, `express()` vs `Router()`, HTTP 메서드 매칭, `async`/`await`) 순차 설명 — 코드 변경 없음
- `app.ts`/`routes/index.ts`에 `express()`/`Router()` 역할 설명 주석 추가
- `docs/api-spec.md`에 "엔드포인트 전체 요약 (구현 파일 매핑)" 표 신규 추가, `docs/api-spec.html`의 기존 요약 표에도 "구현 파일" 열 추가 + 누락된 FCM device-token 2개 행 보강 + `.method.delete` CSS 추가
- 기존 API 명세서 아티팩트를 동일 링크로 재발행해 최신 내용 반영
- git add/commit/push 완료 — 이번 세션 변경사항 전체를 `WHS-After-Mate/Backend` main에 반영 (`16c2f5f..d900124`)

## 2026-08-02
- Android Studio 클라이언트 개발 확정에 맞춰 백엔드 기술 스택 결정: Node.js+Express+TypeScript / Supabase(Postgres+Auth) / Anthropic Claude API / FCM(푸시)
- `server/` 백엔드 전체 구현 완료 — 인증(전화인증+회원가입+로그인/refresh/logout), 홈/추천, 사후관리 daily-guide·Q&A(Claude 구조화출력+위험신호/카테고리 사전필터+알러지컨텍스트+medical_data_access_log), My Care(캘린더/이력/이용권), 프로필/알림+FCM 디바이스 토큰 신규 엔드포인트
- DB 마이그레이션 SQL 작성(001 기존 스키마 8종 + 002 신규 `reference_guides`/`device_tokens`), `care_records.care_type` 컬럼 추가
- 검수 가이드(RAG 소스) 저장 위치 미확정 사항을 `reference_guides` DB 테이블로 확정
- 데모 시드 스크립트 작성, 빌드/타입체크 통과 확인, docs 3종에 구현 확정 사항 반영, server/README.md 작성
- Supabase 프로젝트 실제 생성 → `server/.env` 연동(URL 오타 수정 포함), 001·002 마이그레이션 적용 및 10개 테이블 생성 확인
- Anthropic API 키 발급 적용 후 서버 기동, 로그인→홈→daily-guide→questions(정상답변/out_of_scope/위험신호 3케이스) 엔드투엔드 테스트 전부 통과
- 버그 발견/수정: Claude 응답에 `</answer>`/`</invoke>` XML 태그 흔적 섞이는 현상 → `sanitizeLlmText.ts` 추가로 해결, 재검증 완료
- 루트 README.md에 "구현 현황" 섹션 추가(기존 내용 유지, 신규 섹션만 덧붙임)
- git commit + push 완료 — `server/` 전체 구현 + docs 반영분을 `WHS-After-Mate/Backend` main에 반영 (`16c2f5f`), `.env` 등 민감 파일 제외 확인

## 2026-07-30
- Manyfast "WHS After Mate" 프로젝트 PRD/유저플로우(v2) 확인
- API 명세서 작성(md+html), v0.1 → v0.4까지 반복 개정
  - 초기 MVP 스펙(가상 로그인 가정) → 실제 계정 로그인 + LLM 기반 일차별 사후관리로 전환
  - 사후관리 카드/AI에게 물어보기 버튼 진입 경로, My Care 캘린더/이력/이용권 구조 반영
  - 전화번호 SMS 인증 회원가입 플로우 추가 (/auth/signup/verify-phone/*, /auth/signup)
- API 유저플로우 다이어그램(api-user-flow.html) 제작 — mermaid flowchart, 확대/드래그 뷰어 추가
- API 명세서와 유저플로우 다이어그램 섹션 순서·엔드포인트 일치 검증 및 보정 (recommendations 홈으로 이동 등)
- DB 선택 논의: PostgreSQL(Supabase) 확정, Firebase/MySQL/MongoDB 대안 비교
- DB 스키마 작성(db-schema.md+html) — ERD, 테이블별 DDL, 설계 결정/트레이드오프 정리
- "의료 정보 시스템" 특성 반영: 클리닉 EMR 동기화 구조로 care_records 확장(doctor_comment), medical_profiles(알러지·기저질환), medical_data_access_log(감사로그) 신설
- db-schema.html mermaid ERD 렌더링 버그 수정 (`PK_FK` → `PK`)
- LLM 호출 지점 질의응답: daily-guide(하루 1회 캐시)/questions(매 요청) 2곳뿐이며, 카테고리·위험신호는 LLM 호출 전 규칙 기반 차단이라는 점 설명
- LLM 프롬프트 설계 문서 신규 작성(llm-prompt-design.md+html) — 공통 원칙, 파이프라인 다이어그램, 두 호출 지점별 컨텍스트 주입 필드·시스템 프롬프트 초안·출력 JSON 스키마·실패 폴백 정책, 버전 관리 확장안, 미확정 사항 정리
- GitHub 저장소(WHS-After-Mate/Backend) 연결 — git init, .gitignore(.claude/settings.local.json 제외), 첫 커밋으로 docs/·.work-log/·와이어프레임 이미지 푸시
- README.md 작성 및 푸시 — 프로젝트 개요, 기술 스택 표, 문서 4종 인덱스, 아키텍처 요약, 미확정 사항
- git fetch로 origin/main 커밋 해시 비교해 README 반영 여부 확인
