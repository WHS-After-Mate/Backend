# After School 현재 상태
최종 업데이트: 2026-08-16 10:45

## 프로젝트 개요
WHS After Mate — AAC 웰니스 고객용 관리 이력·이용권 조회, LLM 기반 일차별 사후관리 안내·질문, 다음 관리 추천 MVP(3주 해커톤). 앱 클라이언트는 Android Studio(네이티브 Android), 고객용 백엔드(`server/`)는 Node.js + Express + TypeScript, DB/인증은 Supabase, LLM은 Anthropic Claude API, 푸시는 FCM. 관리자용 웹(`admin-web`, **별도 GitHub 저장소 — 이 백엔드 리포에서는 건드리지 않음**)과 그 백엔드(`server_admin/`, 이 리포에 포함)가 클리닉별 로그인 기반 가상 EMR 입력 도구로 자리잡았다.

## 완료된 작업
- **미커밋 대량 변경분 commit+push** (`9e600e7`) — interestGoals 회원가입, 비밀번호 재설정 숫자코드화, OTP 자릿수 완화, `docs/api-spec.md`/`.html` 재동기화 등 이전 세션분 전부 반영
- **Resend 커스텀 도메인 대신 발송 전용 Gmail 계정(`ykenko02@gmail.com`) SMTP로 전환** — Resend 샌드박스 발신 주소(`onboarding@resend.dev`)는 계정 소유자 본인 이메일로만 발송 가능하고, 이를 풀려면 도메인 구매·인증이 필요했음. 도메인 미보유 상태라 사용자가 "도메인 없이 실사용자에게 보내는 방법"으로 Gmail SMTP를 역제안 → 개인 메인 계정(`yongsang0615@gmail.com`) 대신 **발송 전용 새 Gmail 계정을 만들어 격리**하기로 결정(계정 잠금 리스크가 실제 개인 계정에 영향 안 주도록)
  - `ykenko02@gmail.com`에 2단계 인증 활성화(사용자 직접, 전화번호 인증) → 앱 비밀번호 발급(사용자 직접, 자격증명이라 대신 입력 안 함)
  - Supabase 대시보드(project ref `qcaivwfjgubievzijkwi`, "youyongsang's Project MS") → Authentication → Emails → SMTP Settings: Host `smtp.gmail.com`/Port 587/Username `ykenko02@gmail.com`을 브라우저 자동화로 채우고, Password(앱 비밀번호)는 사용자가 직접 입력
  - Supabase가 저장 시 "개인용 이메일 발송에 최적화된 프로바이더" 경고를 띄움 — 예상된 트레이드오프로 README에 그대로 기록
- **Reset Password 이메일 템플릿에서 링크(`{{ .ConfirmationURL }}`) 제거** — 코드 전용 플로우라 링크가 불필요하다는 사용자 요청. Source 탭에서 링크 관련 문단 삭제, `{{ .Token }}` 인증코드 문단만 유지
- **Gmail SMTP 전환 라이브 종단 검증** — 로컬 서버(포트 4000) 기동 후 `POST /api/v1/auth/password/reset-request`를 curl로 반복 호출(Supabase 레이트리밋 60초 회피), `yongsang0615@gmail.com` 받은편지함을 브라우저로 직접 열어 확인. 템플릿 저장 직후 발송된 메일은 옛 버전(캐시 지연, 1~2분)이었고, 그 다음 발송분부터 링크 없이 인증코드만 포함된 새 템플릿으로 정상 수신 확인
- `docs/api-spec.md`/`.html`, `server/README.md`의 "Resend 커스텀 SMTP" 관련 문구를 Gmail SMTP 전환 내용으로 갱신, "API 명세서" 아티팩트 재발행(https://claude.ai/code/artifact/5cf6ed55-908b-4567-aa90-6357b35c52b6)
- 위 문서 갱신분 commit+push 완료 (`9f2eeb6`)
- 테스트용으로 띄운 로컬 서버는 검증 완료 후 종료(PID taskkill)

- **`docs/db-schema.md`/`.html`, `docs/server-code-guide.md`/`.html`, `docs/llm-prompt-design.md`/`.html` 전면 재동기화** — 마이그레이션 007~012(이용권 잔여횟수 생성컬럼/클리닉 관리자 로그인·`admin_accounts`/`store`컬럼 제거+`emr_patients.brand`/인증코드 절차 제거(회원가입을 환자번호+이름+생년월일 대조로)/`emr_care_records`↔`emr_memberships` 연결/관리부위 배열화)까지 전부 문서에 반영. `db-schema.md`는 특히 회원가입 흐름·`emr_patients`/`emr_care_records`/`emr_memberships` 테이블 정의가 여전히 옛 인증코드 방식으로 남아있던 걸 발견해 전면 재작성, `signup_verification_codes` 제거 이력·`admin_accounts` 신규 테이블 추가. `llm-prompt-design`은 LLM 파이프라인/프롬프트 자체는 변경 없음을 확인하고 stale 버전 각주만 정정. 아티팩트 3종(DB 스키마/서버 코드 설명서/LLM 프롬프트 설계) 재발행
- 위 문서 동기화분 commit+push 완료 (`815667b`)
- **와이어프레임(`docs/After_Mate.png`, 14개 화면) vs server API 전수 대조** — 사용자 요청으로 필드 단위 비교. `home/AI 추천/My Care 3탭/관리 상세/AI 챗봇/내 정보`는 전부 구현 확인. 실질적 미구현 1건 발견: **13. 설정 화면의 "사후관리 알림"/"마케팅 알림" 토글** — 대응 API가 마이그레이션 005에서 완전히 삭제된 상태(발송 스케줄러 없는 placeholder였다는 이유였음). 사용자 판단으로 **이 항목은 보류(불필요)** 확정
- **05. 비밀번호 찾기 화면 재검토** — 와이어프레임이 "인증번호 발송"→"인증번호 확인"→"비밀번호 변경하기" 3버튼인데 반해, 구현은 코드검증+비밀번호변경을 `reset-confirm` 하나로 합쳐뒀던 걸 발견. 사용자가 "와이어프레임대로 가자"고 결정 → **`POST /auth/password/reset-verify` 신규 구현**(코드만 검증해 `resetToken` 발급, Supabase recovery OTP는 검증 시 1회성 소진되므로 재사용 불가 — 실측 확인) + `reset-confirm`을 `{resetToken, newPassword}`로 시그니처 변경(더 이상 email/code 직접 안 받음). `passwordResetVerifySchema`/`passwordResetConfirmSchema`(validators), `verifyPasswordResetCode`/`confirmPasswordReset`(service), 라우트 추가(routes), 테스트 페이지 3버튼 흐름(`api-call-example.html`)까지 전부 반영
- 발송→확인(resetToken 발급)→변경→새 비밀번호 로그인 4단계 전체를 `yongsang0615@gmail.com` 실계정으로 라이브 검증, 코드 재사용 시도 시 거부되는 것도 확인
- `docs/api-spec.md`/`.html`, `docs/server-code-guide.md`/`.html`, `server/README.md` 갱신, 아티팩트 2종(API 명세서/서버 코드 설명서) 재발행
- commit+push 완료 (`df377e9`)
- **`docs/api-spec.md`/`.html`에 `admin-api-spec.md` 스타일로 Response 필드 표 전면 추가** — 사용자 요청. 거의 모든 엔드포인트의 Response 예시 JSON 아래에 필드/타입/설명 표를 붙임(중첩 필드는 `a.b`/`items[].x` 표기로 admin-api-spec과 동일 컨벤션). 작업 중 이전 세션(db-schema/server-code-guide 동기화)에서 놓쳤던 stale 필드 2건 발견해 같이 수정: `care_records.store`(009에서 삭제됐는데 예시 JSON에 남아있었음), `partOfBody`(012에서 배열화됐는데 예시가 여전히 단일 문자열). `.html`엔 `POST`/`DELETE /notifications/device-token` 카드 자체가 아예 빠져있던 것도 발견해 추가(.md엔 있었음)
- 아티팩트(API 명세서) 재발행, commit+push (`4c72796`)
- 사용자가 "/auth/signup 설명에 오류가 있는 것 같다"고 지적 → 확인해보니 엔드포인트 요약 표/배지/v0.6 절 3곳에 "환자번호+인증코드"라는 옛 표현이 남아있었음(010에서 이미 이름+생년월일 대조 방식으로 바뀌었는데 이 3곳만 안 고쳐져 있었음) — 수정
- 사용자 요청으로 validators 코드와 api-spec.md 전체를 대조하는 좀 더 넓은 점검 진행 — `PATCH /profile`(Request/Response 필드 표 자체가 없었음), `POST /aftercare/questions`(Request 표 없음, question 1000자 제한 미문서화), 공통 에러 코드 표에 `INVALID_CREDENTIALS` 누락 — 전부 발견해 보완
- 아티팩트 재발행, commit+push (`3b7bff7`)
- 사용자가 `docs/WHS_After_Mate_Admin_revised.html`(관리자 웹 프로토타입, 정적 데모)을 업로드 → 대조해 미구현 사항 구현 요청. 사전 결정 3가지 확인: ① `GET /visit-stats`를 "이틀전/하루전/금일"에서 "전날/금일/익일 예약"으로 변경 ② 시술기록에 이미 있는 `careDate`를 미래 날짜로 넣는 것만으로 "예약"을 표현(별도 예약 테이블/컬럼 신설 없음) ③ 예약 취소·앱↔웹 동기화는 이번 범위에서 명시적으로 제외(사용자가 작업 도중 "취소는 아직 구현하지 말고 대시보드 표시만" 이라고 재확인)
  - 코드 확인 결과 `createCareRecordSchema.careDate`가 애초에 미래 날짜를 막지 않고 있어 ②는 검증기 변경 불필요했음
  - `patients.service.ts`의 `getVisitStats`를 `{yesterday, today, tomorrow}` 3키로 재구성(`kstDateString`에 음수 `daysAgo`를 처음 사용해 내일 날짜 계산) — 나머지 identity-dedup 로직은 그대로 재사용
  - 실서버로 내일 날짜(`2026-08-17`) 시술기록 생성 → `tomorrow.count`에 반영되는 것까지 라이브 검증 후 테스트 데이터(환자/시술기록/이용권) 정리
  - `docs/admin-api-spec.md`/`.html`(v0.1→v0.2), `server_admin/README.md` 동기화, 아티팩트 재발행
  - commit+push (`653bed8`)
- **프로토타입의 치료-부위 카탈로그 + 이용권 만료/자동 이어쓰기 방식 도입** — 사용자에게 "프로토타입 방식을 따라갈 경우 생길 변수"(카탈로그 범위, 만료 기준일, 관리 API 필요 여부)를 먼저 설명 → 사용자가 3가지 확정: ① 카탈로그는 클리닉별이 아니라 전체 공통 ② 만료일은 이용권 생성일(첫 시술일)+1년 고정(재계산 안 함) ③ 카탈로그 항목도 관리자 CRUD API로 구현
  - 신규 테이블 `treatment_catalog`(마이그레이션 013, 사용자가 Supabase SQL Editor에서 직접 적용) — 치료명(unique)→기본 careType/관리 부위 매핑, brand 컬럼 없음(공통). `GET`/`POST`/`PATCH`/`DELETE /treatment-catalog` 신규(`catalog.routes.ts`/`catalog.service.ts`/`catalog.validators.ts`). 시술기록 저장(`POST .../care-records`)은 카탈로그를 강제하지 않고 여전히 `careName`/`careType`/`partOfBody`를 그대로 받음(제안용 데이터일 뿐)
  - `memberships`/`emr_memberships.expires_at`(001부터 있던 컬럼인데 그동안 `server_admin`이 값을 넣지 않아 항상 null이었음을 코드로 확인) — 새 이용권 생성 시 `careDate`+1년으로 채우기 시작, 차감 시 만료 확인해 만료면 `409 MEMBERSHIP_EXPIRED`(신규 에러코드)로 거부
  - 이용권 자동 이어쓰기 — `totalSessions`(직접입력)로 요청 시 같은 `product_name`+`total_count`로 아직 유효한(소진·만료 안 된) 이용권을 먼저 찾아 있으면 이어서 차감, 없으면 새로 생성. 응답에 `membershipCreated`(boolean) 추가해 신규 생성 여부 구분
  - 실서버로 카탈로그 CRUD(생성/검색/중복거부/수정/삭제), 자동 이어쓰기(동일 이용권 재사용+`used_count` 증가 확인), 강제로 과거 날짜를 넣어 만료시킨 이용권에 대한 명시적 차감 거부(`MEMBERSHIP_EXPIRED`), 만료된 이용권은 자동 이어쓰기 후보에서 제외되고 새 이용권이 만들어지는 것까지 전부 라이브 검증 후 테스트 데이터(환자/시술기록/이용권/카탈로그) 정리
  - `docs/admin-api-spec.md`/`.html`(v0.2→v0.3, "2. 치료-부위 카탈로그" 신규 절, 이후 절 번호 전부 한 칸씩 밀림), `docs/db-schema.md`/`.html`(v0.6→v0.7, `treatment_catalog` 테이블 정의+ERD 추가), `server_admin/README.md` 동기화, 아티팩트 2종(관리자 API 명세서/DB 스키마) 재발행
  - commit+push (`7a94c80`)
- 사용자가 "일단 여기까지만 하고 더 추가해야할 사항은 readme에 넣자"고 정리 요청 → 추가 구현 없이 `server_admin/README.md`의 "미확정/후속 과제"에 이번 작업에서 의도적으로 남겨둔 항목 4개를 문서화만 함(예약 취소 미구현, 카탈로그가 시술기록 저장을 강제하지 않음, 이용권 만료일 재계산 안 됨, 자동 이어쓰기 매칭이 `product_name`+`total_count` 완전 일치일 때만 동작). commit+push (`010af8f`)

## 현재 작업 중
- (없음 — 이번 세션 작업 전부 커밋+푸시+아티팩트 재발행까지 완료)

## 다음 할 일
- 예약 취소 기능 — 사용자가 명시적으로 보류. 나중에 앱과 연동해 금일/향후 예약을 취소하는 기능으로 별도 구현 예정(착수 전)
- (신규, README에 기록됨) 치료-부위 카탈로그가 시술기록 저장(`careName`/`careType`/`partOfBody`)을 강제하지 않음 — 프론트에서 카탈로그로 자동완성만 붙이고 서버는 검증 안 함. 필요해지면 서버 레벨 검증 추가 검토
- (신규, README에 기록됨) 이용권 자동 이어쓰기 매칭 정확도 — `product_name`+`total_count` 완전 일치만 인식. 관리자가 카탈로그에서 치료명을 선택 입력하게 하는 프론트 구현으로 표기 불일치를 줄일 수 있음(아직 미구현)
- 가비아 클라우드 배포 — 크레딧 지급 조건 확인 후 진행 예정(아직 착수 전)
- (이월) 프론트 담당자 GitHub Collaborator 초대 미발송
- (이월) `.env` 비밀값을 프론트 담당자에게 git 아닌 채널로 전달
- (이월) 위험 신호 키워드 목록(`server/src/lib/riskKeywords.ts`) 전문가(의료진) 검수
- (이월) FCM 실제 발송 스케줄러 트리거 로직 미구현
- (이월) refreshToken 만료 정책 확정 미완료
- (이월) `docs/AAC_클리닉_자산_조사.docx` git 커밋 여부 여전히 미결정(untracked)
- Gmail SMTP는 트랜잭션 메일 전용 서비스가 아니라 발송량이 몰리면 스팸/전송 제한 리스크가 있음 — 정식 서비스 규모로 갈 때 도메인 기반 트랜잭션 메일 서비스(Resend 등)로 재검토 필요(도메인 확보되면)

## 주요 파일
- `server_admin/src/services/patients.service.ts` — 환자/시술기록/이용권/방문통계 전체 로직. claim 여부 분기(emr_* vs 실제 테이블), 중복 환자 재사용+notes 갱신, `getVisitStats`(전날/금일/익일 예약), 이용권 만료(`addOneYear`)/자동 이어쓰기(`findContinuableMembership`)
- `server_admin/src/services/catalog.service.ts`(신규) — 치료-부위 카탈로그 CRUD, `assertValidCareType`은 `patients.service.ts`에서 export해 재사용
- `docs/WHS_After_Mate_Admin_revised.html` — 관리자 웹 정적 프로토타입(신규 업로드, git 미추적 상태 — 참고용 데모, 실제 API 연동 없음). 대시보드 3카드/관리 등록 모달/치료-부위 카탈로그 구조를 실제 구현에 반영 완료
- `server/src/services/auth.service.ts` — `signup()`(interestGoals 포함), `requestPasswordReset`/`confirmPasswordReset`(숫자 코드 방식, Gmail SMTP로 발송)
- `docs/admin-api-spec.md`/`.html` — server_admin 전체 API 명세, 아티팩트로도 발행됨
- `docs/api-spec.md`/`.html` — 고객용 server/ API 명세, 이번 세션에 SMTP 전환 문구 갱신 + reset-verify 반영 + admin-api-spec 스타일 Response 필드 표 전면 추가
- `server_admin/README.md`, `server/README.md` — 각각 엔드포인트 요약 및 구현 노트, 이번 세션 SMTP TODO 항목 갱신
- Supabase 프로젝트: "youyongsang's Project MS"(ref `qcaivwfjgubievzijkwi`) — SMTP 발신 계정은 `ykenko02@gmail.com`(발송 전용)
- `docs/db-schema.md`/`.html`, `docs/server-code-guide.md`/`.html` — 이번 세션에 007~012 마이그레이션 + reset-verify 반영해 재동기화
- `server/src/services/auth.service.ts` — `verifyPasswordResetCode`(신규)/`confirmPasswordReset`(resetToken 방식으로 변경)
- GitHub: https://github.com/WHS-After-Mate/Backend (main, 최신 push는 `010af8f`)

## 특이사항 / 결정 사항
- **비밀번호 재설정 이메일 발송은 Resend가 아니라 발송 전용 Gmail 계정 SMTP를 사용** — 도메인 구매 없이 실사용자 전체에게 발송 가능하게 하기 위한 선택. 개인 메인 Gmail 계정이 아니라 이 용도로만 새로 만든 계정(`ykenko02@gmail.com`)을 써서, Google이 이상 발송으로 계정을 잠그더라도 개인 계정에 영향이 없도록 격리함
- **Supabase Auth 이메일 템플릿 변경은 저장 직후 바로 반영되지 않을 수 있음** — Source 탭 "Save" 성공 토스트가 떠도 실제 발송에는 1~2분의 캐시 지연이 있었음(실측). 템플릿 변경 후 즉시 테스트하면 옛 버전이 갈 수 있으니, 검증 시 "가장 최근" 메일인지 타임스탬프로 확인할 것
- **자격증명은 절대 대신 입력하지 않음** — Google 계정 로그인/2단계 인증/앱 비밀번호, Supabase SMTP Password 필드는 전부 사용자가 직접 입력하도록 안내만 하고, 나머지 비밀 아닌 필드(Host/Port/Username 등)만 브라우저 자동화로 채움
- **비밀번호 재설정 인증코드는 표준 "6자리"가 아님** — Supabase 프로젝트 설정에 따라 자릿수가 달라질 수 있고 이 프로젝트는 실측 8자리. 이 프로젝트 관련 문서/검증 로직에 자릿수를 하드코딩하지 말 것(6~10자리로 느슨하게 검증)
- **Windows tsx watch 재시작 이슈** — 여전히 유효, `npm run build` 후 `node dist/src/server.js` 권장
- 세션 재시작 시 이 파일이 자동으로 브리핑됨(글로벌 CLAUDE.md 설정)
