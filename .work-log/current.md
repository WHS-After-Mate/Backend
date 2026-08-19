# After School 현재 상태
최종 업데이트: 2026-08-19 17:20

## 프로젝트 개요
WHS After Mate — AAC 웰니스 고객용 관리 이력·이용권 조회, LLM 기반 일차별 사후관리 안내·질문, 다음 관리 추천 MVP(3주 해커톤). 앱 클라이언트는 Android Studio(네이티브, **프론트엔드는 사용자 담당 아님**), 고객용 백엔드(`server/`)는 Node.js + Express + TypeScript, DB/인증은 Supabase, **LLM은 OpenAI API**(`gpt-4.1-mini`), 푸시는 FCM. 관리자용 웹(`admin-web`, 별도 저장소, **임시/프로토타입 취급**)과 그 백엔드(`server_admin/`, 이 리포 포함)가 클리닉별 로그인 기반 가상 EMR 입력 도구. **가비아 클라우드에 실제 배포됨**(`1.201.116.115`, 2026-08-18~8/28 한시 운영) — 두 프론트팀(Android/admin-web)이 이 서버를 baseUrl로 쓰고 있음.

## 완료된 작업
- **categoryTags 변경 commit+push 완료** (`5da347b`) — 이전 세션에서 만든 `popularWithSimilarCustomers` → `categoryTags` 교체를 이번 세션 시작 시 확인 후 커밋(`docs/image.png`/미추적 파일 2개는 관례대로 제외)
- **🚨 이월 장애 해결 확인** — 사용자가 배포 서버에서 `git pull && npm run build && pm2 restart`를 실행한 뒤(사용자가 직접 서버 터미널에서 처리, 관례상 처음엔 `~/Backend`가 아닌 경로에서 실행해 "not a repository" 오류 → 올바른 디렉토리 안내), 새 테스트 계정(가입~탈퇴까지 서비스롤 스크립트로 생성/정리)으로 실제 curl 검증: `GET /aftercare/daily-guide` 200(`generatedBy: "llm"`), `GET /home/summary`의 `aftercareCard` 정상 채워짐, `GET /recommendations/next-care/{id}`의 `categoryTags`도 정상 반영 — 배포 서버가 최신 코드로 정상 동작 중임을 확인
- **`careType` 자동조회(treatment_catalog) 구현 — "웹/앱 모두 관리명+부위만 구현" 프론트 피드백 대응**: 사용자가 work-log의 이월 항목(`treatment_catalog`의 botox care_type 분리 등)을 보다가 "careType은 안 해도 될 것 같다, 프론트가 관리명+부위만 구현하기로 했었다"는 예전 피드백을 상기 → `careType`이 daily-guide 매칭 키로 실질적으로 필수라는 점을 설명 → 사용자가 "treatment_catalog에서 DB가 알아서 인식하게 하자"(옵션 A)로 결정
  - `server_admin/src/validators/patients.validators.ts`: `createCareRecordSchema`에서 `careType` 필드 제거(클라이언트 입력 안 받음)
  - `server_admin/src/services/patients.service.ts`: `lookupCareType(careName)` 신규 — `treatment_catalog.care_name`으로 조회해 `care_type` 자동 채움(매칭 없으면 `null`, 기존 `assertValidCareType` 400 차단 로직은 `care-records`에서 제거하고 `treatment_catalog` CRUD에만 유지)
  - `server_admin/src/routes/patients.routes.ts`: `GET /care-types` 주석 갱신(이제 시술기록 추가가 아니라 treatment-catalog 등록/수정 화면 전용)
  - `server_admin/src/examples/admin-api-example.html`: D 섹션에서 careType select 제거
  - typecheck/build 통과, 로컬(4100) + **배포 서버(1.201.116.115)** 양쪽에서 실라이브 검증(treatment_catalog에 시술 등록 → careType 없이 시술기록 생성 → 응답의 care_type이 자동으로 채워지는 것 확인, 테스트 데이터 전부 정리)
- **문서 동기화 + commit+push** (`38659a3`) — `docs/admin-api-spec.md`/`.html`(v0.8→v0.9), `docs/db-schema.md`/`.html`(treatment_catalog 절에 v0.9 동작 반영, 상단/footer의 스펙 버전 참조 오류도 같이 정정: v0.6/v0.11→v0.9/v0.15), `server_admin/README.md`(엔드포인트 표 2곳 + 미확정 과제 항목 갱신). HTML 태그 균형(table/tr/div open-close) 확인 완료
- **이용권 차감/자동이어쓰기 로직 설명** — 사용자 질문("관리명+횟수 같으면 1회 차감, 다르면 추가, 0회 돼도 삭제 안 됨 맞지?")에 코드(`findContinuableMembership`, `patients.service.ts:372-394`) 근거로 확인 답변(대체로 맞음, 다만 매칭은 `membershipId` 직접선택 경로엔 적용 안 되고 `totalSessions` 경로에만 적용되는 점, 만료 조건도 함께 본다는 점 보완)
- **admin-web 실제 구현 상태 조사** — 사용자가 "환자 카드에서 시술추가 누르면 이름/생년월일 자동입력 + 보유 이용권 자동서치되게 설계했는데 잘 됐나" 질문 → 로컬 `admin-web` 클론이 `initial commit`(스캐폴드)에서 멈춰있던 걸 발견해 `git pull`로 실제 최신 코드(`TreatmentModal.jsx`, `CustomerDetailModal.jsx` 등) 받아 직접 확인
  - 환자 이름 자동입력은 됨(`customer={{id, name}}`로 모달에 전달), 생년월일은 애초에 이 모달에 입력 필드가 없어 해당 없음
  - **이용권 자동서치는 프론트에 미구현** — `TreatmentModal.jsx`가 `GET /patients/:patientId`의 `memberships`를 한 번도 안 불러오고, 이용권 select UI 자체가 없으며, 제출 시 항상 `totalSessions`만 보내고 `membershipId`는 절대 안 보냄(`handleSubmit`, line 258-265) → 백엔드 자동 이어쓰기 매칭이 우연히 걸릴 때만 재사용되고 그 외엔 매번 새 이용권 생성됨
  - 사용자가 "admin-web은 임시라 안 고쳐도 된다, API가 그 기능을 제공하는지가 중요하다"고 명확히 함 → `GET /patients/{patientId}` 응답이 이미 `patient`(이름/생년월일 등) + `memberships`(보유 이용권 전체, 잔여횟수 포함) 전부 반환하고 있어 **API 설계상으로는 필요한 데이터가 이미 완전히 제공됨**을 확인해 답변(프론트가 안 쓴 것뿐, 백엔드 갭 아님)

## 현재 작업 중
- (없음 — 이번 세션 작업은 모두 커밋/배포/검증까지 완료됨)

## 다음 할 일
- admin-web의 이용권 자동서치 미구현은 "임시 프로토타입이라 안 고쳐도 됨"으로 사용자가 결정 — 별도 후속 조치 불필요(참고용으로만 기록)
- `treatment_catalog`의 `botox` care_type 분리(근육형/피부형) — 여전히 미착수(이월)
- `treatment_catalog` 시술명 2건 오타/불일치(`튠 콩피에르®`, `레이저 제모 솔루션`) 실제 엑셀 원본과 맞출지 결정 필요(이월)
- questions.prompt는 여전히 `reference_guides`(미검수 5종 포함)를 `reviewedGuide`로 주입 중 — 근거 원칙 바꿀지 미정(이월)
- `reference_guides` 미검수 스텁 전문가 검수 여전히 필요(이월)
- 위험 신호 키워드 목록(`server/src/lib/riskKeywords.ts`) 전문가 검수(이월)
- `docs/image.png`가 원인불명으로 변경돼 있음(171KB→13KB) — 여전히 미해결, 이번 세션에도 커밋 대상에서 계속 제외
- 미추적 파일(관례상 커밋 제외 중): `docs/AAC_클리닉_자산_조사.docx`, `docs/WHS_After_Mate_Admin_revised.html`
- FCM 실제 발송 스케줄러 트리거 로직 미구현(이월)
- refreshToken 만료 정책 확정 미완료(이월)

## 주요 파일
- `server_admin/src/services/patients.service.ts` — **이번 세션**. `lookupCareType()` 신규(careType 자동조회), `addCareRecord()`에서 클라이언트 careType 대신 이 값 사용
- `server_admin/src/validators/patients.validators.ts` — `createCareRecordSchema`에서 careType 필드 제거
- `server_admin/src/routes/patients.routes.ts` — `GET /care-types` 용도 주석 갱신(treatment-catalog 전용으로 변경)
- `server/src/services/recommendations.service.ts` — 지난 세션 `categoryTags` 변경, 이번 세션에 커밋 완료
- `docs/admin-api-spec.md`/`.html` — v0.9. `docs/db-schema.md`/`.html` — v0.9(footer 스펙 버전 참조 정정 포함). `server_admin/README.md`도 갱신
- `admin-web/`(로컬 클론) — 이번 세션에 `git pull`로 최신화(기존엔 initial commit만 있었음). `src/pages/Treatment/TreatmentModal.jsx`, `src/pages/CustomerDetail/CustomerDetailModal.jsx` — 시술 등록 모달, 이용권 선택 UI 없음(프론트 갭, 백엔드 API는 지원함)
- GitHub: https://github.com/WHS-After-Mate/Backend (main, 최신 push는 `38659a3`)
- 배포 서버: 가비아 클라우드 `1.201.116.115` — `~/Backend`에 git clone, pm2 프로세스명 `whs-server`(4000, server용)/`server_admin` 쪽 프로세스명은 여전히 미기록. 이번 세션 변경(careType 자동조회)까지 정상 배포·검증 완료

## 특이사항 / 결정 사항
- **`careType`은 관리자가 자유 입력하던 값에서 서버가 `treatment_catalog`로 자동 채우는 값으로 전환** — 프론트(웹/앱)가 "관리명+부위만 구현"하기로 이미 결정했던 것과 daily-guide가 `care_type` 매칭 키를 필요로 하는 것 사이의 충돌을 `treatment_catalog` 재활용으로 해결. 카탈로그에 없는 치료명이면 `care_type: null`로 저장되고, 그 시술기록의 daily-guide는 계속 404로 폴백됨(기존과 동일한 성격의 한계, 새로 생긴 문제 아님)
- **admin-web은 "임시" 취급이 사용자 쪽에서 명확히 재확인됨** — 프론트 코드 자체의 결함(이용권 select 미구현)을 발견했지만 고칠 필요 없음. 다만 **API가 그 기능을 지원하는지**는 별개로 중요한 질문이었고, `GET /patients/{patientId}`가 이미 필요한 데이터(patient+memberships)를 전부 반환하고 있어 백엔드 설계엔 문제 없음을 확인
- **admin-web 리포가 로컬 클론보다 훨씬 앞서있었음** — 로컬엔 `initial commit`(스캐폴드)만 있었는데 원격엔 로그인/대시보드/고객관리/시술등록 모달까지 실제 구현된 커밋이 여러 개 있었음. 이번에 `git pull`로 따라잡음 — 다음에 admin-web 관련 질문 나오면 항상 최신인지 먼저 fetch/pull 확인할 것
- **커밋 전 항상 사용자에게 확인** — 세션 규칙으로 고정. 이번 세션도 "커밋 및 푸시" 명시적 요청 받고서만 진행
- **가비아 서버 root 비밀번호는 어디에도 기록돼 있지 않음**(의도적으로 저장 안 함) — 필요시 가비아 콘솔에서 직접 확인해야 함
- 세션 재시작 시 이 파일이 자동으로 브리핑됨(글로벌 CLAUDE.md 설정)
