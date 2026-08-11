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
  - 이번 세션 Tier 1 변경사항은 git 미커밋 상태로 세션 종료

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
