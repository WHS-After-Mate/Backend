# After School 현재 상태
최종 업데이트: 2026-08-05 00:34

## 프로젝트 개요
WHS After Mate — AAC 웰니스 고객용 관리 이력·이용권 조회, LLM 기반 일차별 사후관리 안내·질문, 다음 관리 추천 MVP(3주 해커톤). 앱 클라이언트는 Android Studio(네이티브 Android), 백엔드는 Node.js + Express + TypeScript, DB/인증은 Supabase, LLM은 Anthropic Claude API, 푸시는 FCM으로 확정하고 실제 구현·연동까지 완료한 상태.

## 완료된 작업
- (이전 세션까지) 백엔드 전체 구현 + Supabase 연동 + 엔드투엔드 테스트 완료, 데모 계정 4명(`demo@`~`demo4@whsaftermate.app`) 시드, GitHub 리포(`WHS-After-Mate/Backend`, private) main에 `3a97609`까지 반영·푸시 완료. GitHub Collaborator 초대는 아직 미발송 상태로 이번 세션 진입
- (이번 세션) **개념 설명 Q&A 다수** — 사용자가 Express/Node·클라이언트-서버 구조를 배우는 중이라 코드 변경 없이 순차 설명함
  - "프론트가 내 리포 clone해서 서버만 실행하면 되나 / 구조 바꿀 필요 없나" → 코드 구조 변경 불필요, `app.listen()` host 미지정이라 이미 모든 인터페이스에서 열림, `CORS_ORIGIN=*`라 안드로이드 요청도 허용됨을 코드로 확인해 답변
  - "같은 컴퓨터에서 진행해야 하나" 오해 정정 — localhost는 각자 컴퓨터 기준이라 프론트/백엔드 각자 자기 컴퓨터에서 로컬 서버를 띄우면 됨 (DB는 Supabase 클라우드 공유라 데이터는 동일하게 보임)
  - "백엔드 API 만든 게 서버로 돌아가는 구조가 맞냐" → `app.ts`(설계도, `listen()` 없음) vs `server.ts`(`app.listen()`으로 실제 포트 여는 지점) 구조 코드로 확인해 설명, 카카오톡 비유로 클라이언트-서버 개념 정리
  - "버튼 누르면 요청 보내는 코드는 누가 짜냐" → 프론트(Retrofit) 담당, 서버는 요청 처리만 한다고 역할 분담표로 정리
  - "코드니까 앱에서 그냥 import해서 백엔드 실행하면 안 되나" → (1) Node.js/TS와 안드로이드 JVM/코틀린은 런타임이 달라 애초에 import 불가 (2) 된다 해도 비밀키 유출/공유데이터 신뢰성/로직 신뢰/업데이트 배포 문제로 클라이언트-서버 분리가 필요하다고 설명
  - "안드로이드(프론트)는 이 API를 실제로 어떻게 호출하냐" → `GET /home/summary` 예시로 Retrofit interface 선언 → baseUrl 지정 → 버튼 클릭 시 suspend 함수 호출하는 실제 Kotlin 코드 예시 제공
  - "로컬호스트로 열면 동일 LAN만 연결 가능한 거냐" 오해 정정 — localhost/10.0.2.2는 같은 기기 자신만 가능, LAN의 다른 기기가 붙으려면 서버 컴퓨터의 LAN IP를 써야 함(서버는 이미 모든 인터페이스에 열려있어 코드 수정 불필요, 방화벽 포트 허용만 필요)을 표로 정리
- (이번 세션) **신규 문서 `docs/frontend-integration-guide.md` 작성** — 프론트(Android) 담당자용 실행 절차 문서: 저장소 clone 위치(별개 폴더), `.env` 설정(비밀값은 별도 채널 전달, 마이그레이션/시드 재실행 금지 경고), `npm run dev` 실행+`/health` 확인, baseUrl 표(에뮬레이터 `10.0.2.2` vs 실기기 LAN IP), `network_security_config.xml`/`AndroidManifest.xml` cleartext 설정 코드, 데모 계정 4개 표, Retrofit 호출 예시 코드, 자주 막히는 지점(Connection refused/cleartext 차단/401/실기기 접속 안됨) 체크리스트
- **동일 내용의 `.html` 버전(`docs/frontend-integration-guide.html`) 제작** — 기존 docs 3종(api-spec/db-schema/server-code-guide)과 동일한 CSS 디자인 시스템(스티키 목차, endpoint-card, table-wrap, status-chip 등)으로 제작
- README.md 문서 인덱스 테이블에 `docs/frontend-integration-guide.md`/`.html` 항목 추가
- Claude 아티팩트로 `docs/frontend-integration-guide.html` 신규 발행 (favicon 📱) — https://claude.ai/code/artifact/d0b80060-4e05-4a4d-9d1c-64296fd7394d
- **배포 관련 논의**: "`10.0.2.2`가 기본 주소냐, 배포해도 이걸 쓰면 되냐" 질문에 — `10.0.2.2`는 에뮬레이터가 자기 호스트 컴퓨터를 가리키는 로컬 전용 특수 주소이며, Render 배포 시 Render가 발급하는 실제 공인 HTTPS 도메인으로 baseUrl을 교체해야 하고 그 이후엔 에뮬레이터/실기기 구분 없이 같은 주소로 통일되며 `network_security_config`의 cleartext 예외도 필요 없어짐을 설명. 프론트 쪽에 baseUrl을 상수로 분리해두라고 제안
- 사용자가 "그럼 서버 배포하는 게 더 편할 것 같다"는 의견 제시 → 배포 시 장점(고정 HTTPS 주소로 통일, 로컬 개발 잡음 제거)과 트레이드오프(재배포 필요해 로컬 핫리로드보다 반영 느림, Render 무료 티어 콜드스타트) 설명하며 "지금 배포 진행할지, 로컬로 며칠 더 연동해볼지" 질문 → **사용자가 "그건 내일하자"고 보류 결정** (이번 세션엔 미진행)
- "주소(baseUrl) 바뀔 때마다 여러 곳에 적어둔 걸 다 바꿔야 하는 거 아니냐"는 질문에 → 하드코딩하면 그렇지만 보통 `object ApiConfig { const val BASE_URL = ... }` 상수 하나로 분리하거나, `build.gradle`의 `buildConfigField`로 debug/release 빌드 타입별 자동 전환하는 방식을 코드 예시로 제안. `frontend-integration-guide.md`에 이 내용을 추가할지 물었으나 아직 반영은 안 함(다음 할 일로 남음)
- 사용자가 제시한 Retrofit 예시 코드(`interface WhsApi`, `Retrofit.Builder()...build()`, `retrofit.create(WhsApi::class.java)`)를 한 줄씩 설명 요청 → `interface WhsApi`는 "선언만 있고 구현은 없는 명세"(`api-spec.md`에 대응), `Retrofit.Builder()...build()`는 통신 설정을 담은 클라이언트 객체 생성(사용자가 이미 아는 `createClient(SUPABASE_URL, KEY)` 패턴과 동일 역할로 비유), `retrofit.create(WhsApi::class.java)`는 인터페이스의 annotation을 읽어 실제 HTTP 요청을 보내는 구현체를 런타임에 자동 생성해주는 Retrofit 고유 메커니즘("동적 프록시")이라고 설명. **사용자가 "내일 다시 물어볼게"라며 이 주제를 이어가기로 함** — 다음 세션에서 Retrofit/Kotlin 관련 후속 질문 가능성 높음

## 현재 작업 중
- **Render 배포 여부/시점 결정 보류 중** — 사용자가 "내일 하자"고 명시적으로 미룸. 다음 세션에서 이 논의를 이어가야 함
- **Retrofit/Kotlin 개념 학습도 "내일 다시 물어볼게"로 보류** — `interface`+`Retrofit.Builder`+`create()` 조합까지 설명한 상태에서 중단, 다음 세션에서 이어질 가능성 높음
- 이번 세션 변경사항(README.md 수정 + 신규 문서 2개)이 **아직 git commit/push 안 된 상태** (work-log 파일 포함 전부 unstaged)
- 프론트 담당자 GitHub Collaborator 초대는 여전히 미발송 (이전 세션부터 이어지는 미완료 항목)

## 다음 할 일
- **Render 배포 여부/시점 결정** — 사용자가 "지금 배포가 더 편할 것 같다"는 의견을 냈으나 내일 다시 논의하기로 함. 배포하기로 하면: Render 프로젝트 생성, `.env` 값을 Render 환경변수로 이전, 배포 후 발급되는 HTTPS 도메인으로 `frontend-integration-guide.md`/`.html`의 baseUrl 섹션 업데이트 필요
- (다음 세션 후보) Retrofit/baseUrl 관리 방식(상수 분리 vs `buildConfigField`) 후속 질문 대응 — 원하면 `frontend-integration-guide.md`에도 이 내용 추가
- 이번 세션에 제안했던 baseUrl 상수화(`ApiConfig`/`buildConfigField`) 가이드를 `frontend-integration-guide.md`에 반영할지 결정 (제안만 하고 아직 문서에는 미반영)
- 이번 세션 변경사항 git add/commit/push (README.md + `docs/frontend-integration-guide.md`/`.html`)
- 프론트 담당자를 GitHub Collaborator로 초대 (`Settings > Collaborators and teams > Add people`)
- `.env` 비밀값을 프론트 담당자에게 git 아닌 채널로 전달
- 위험 신호 키워드 목록(`server/src/lib/riskKeywords.ts`) 전문가(의료진) 검수
- FCM 실제 발송 스케줄러(아침 리마인더 등) — 발송 함수(`push.service.ts`)만 준비된 상태, 트리거 로직 미구현
- refreshToken 만료 정책, 알림 설정 세부 항목 범위 확정 (여전히 미확정)
- `docs/db-schema.html`/`llm-prompt-design.html`은 여전히 .md 변경사항과 미동기화

## 주요 파일
- `server/` — 백엔드 전체 (Node.js+Express+TypeScript), 구조 변경 없음
- `docs/frontend-integration-guide.md`/`.html` — (신규) 프론트(Android) 담당자용 로컬 실행·연동 가이드, 아직 git 미반영
- `README.md` — 문서 인덱스에 frontend-integration-guide 항목 추가됨, 아직 git 미반영
- `docs/api-spec.md`/`.html`, `docs/server-code-guide.md`/`.html` — 기존 문서, 이번 세션엔 내용 변경 없음(참고만 함)
- GitHub: https://github.com/WHS-After-Mate/Backend (main 브랜치 — 최신 push는 `3a97609`, 이번 세션 변경분 미반영)
- Claude 아티팩트: API 명세서, 서버 코드 설명서(이전 세션 발행) + **프론트엔드 연동 가이드**(이번 세션 신규, https://claude.ai/code/artifact/d0b80060-4e05-4a4d-9d1c-64296fd7394d)

## 특이사항 / 결정 사항
- 이번 세션은 대부분 **개념 설명(교육) + 신규 문서 작성**이었고 서버 코드(`server/src`) 자체는 변경하지 않음
- `10.0.2.2`/LAN IP 방식은 "로컬 개발 단계 전용"이며, Render 배포 후에는 공인 HTTPS 도메인 하나로 통일된다는 점을 문서화하지 않고 대화로만 정리함 — 배포 확정되면 `frontend-integration-guide`에도 반영 필요
- Render 배포 시점: 기존엔 "최종 완료 시점에"로 확정했었으나, 이번 세션에서 사용자가 "지금 하는 게 더 편할 것 같다"며 재고 중 — **아직 재확정 안 됨, 내일 논의 예정**
- 세션 재시작 시 이 파일이 자동으로 브리핑됨 (글로벌 CLAUDE.md 설정)
