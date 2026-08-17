# After School 현재 상태
최종 업데이트: 2026-08-18 00:10

## 프로젝트 개요
WHS After Mate — AAC 웰니스 고객용 관리 이력·이용권 조회, LLM 기반 일차별 사후관리 안내·질문, 다음 관리 추천 MVP(3주 해커톤). 앱 클라이언트는 Android Studio(네이티브 Android, **프론트엔드는 사용자 담당 아님 — 이 세션에서 다루지 않음**), 고객용 백엔드(`server/`)는 Node.js + Express + TypeScript, DB/인증은 Supabase, LLM은 Anthropic Claude API, 푸시는 FCM. 관리자용 웹(`admin-web`, **별도 GitHub 저장소 — 이 백엔드 리포에서는 건드리지 않음**)과 그 백엔드(`server_admin/`, 이 리포에 포함)가 클리닉별 로그인 기반 가상 EMR 입력 도구로 자리잡았다.

## 완료된 작업
- **사업장:회원 1:1 구조 한계 해결(다중 클리닉 자동 연결)** — Slack에서 "AAC 산하 여러 클리닉을 다니는 고객이 두 번째 클리닉부터 앱에 기록을 남길 수 없다"는 문제 보고. 원인: `emr_patients.brand`로 환자 행이 클리닉별로 완전 격리돼, 같은 사람이 클리닉 A/B를 각각 방문하면 행이 두 개 생기는데 앱 계정(claim)은 그중 하나에만 걸림 — 재가입 시도는 `profiles.phone` unique 제약에 걸려 일반화된 500으로 실패. **DB 스키마 변경 없이** 두 방문 순서 모두 해결:
  - `server_admin` `POST /patients`: 이름+생년월일+전화번호 일치하는 다른 클리닉의 이미 claim된 행이 있으면(`findLinkedAccountFromOtherClinic`) 새 환자 행을 만들며 등록 즉시 그 계정에 자동 연결(`created_at`==`claimed_at`으로 신규 컬럼 없이 자동연결 여부 표시)
  - `server` `POST /auth/signup`: 가입 시점에 다른 클리닉의 미가입 형제 행(이름+생년월일+전화번호 일치, `claimed_user_id` null)까지 한 번에 같은 계정으로 claim(`migrateEmrDataToApp` 공용 함수로 추출해 형제 행에도 재사용)
  - **마스킹**: 자동 연결된 경우 `claimed_user_id`/`claimed_at`을 이 클리닉 응답에서 `null`로 숨김(`maskAutoLinkedClaim`, `created_at===claimed_at`으로 판별) — 다른 클리닉 방문 이력 노출 방지. `POST/GET/PATCH /patients` 전부 적용, 내부 로직(시술기록 앱 테이블 기록)은 영향 없음
  - SMS 안내는 로그만 남기는 스텁(`notifyExistingAccountLinked`) — 발송 인프라는 비용 문제로 기존에 제거된 상태라 재도입 안 함, "코드만 준비"로 범위 한정
  - 두 시나리오(claim-후-타클리닉등록 / 양쪽등록-후-claim) 전부 실서버 라이브 검증(회원가입→시술기록→고객 앱 `GET /home/summary`/`GET /care-records` 반영 확인), 마스킹도 별도로 3단계(정상 자기클리닉 가입=비마스킹, 타클리닉 자동연결=마스킹, DB엔 실값 존재+시술기록 정상 기록) 검증. 테스트 데이터 전부 정리
  - 문서: `docs/api-spec.md`/`.html`(v0.9→v0.10), `docs/admin-api-spec.md`/`.html`(v0.5→v0.6) — 각각 새 changelog 섹션 추가, 필드 마스킹 설명, 알려진 제한사항 갱신. 아티팩트 재발행
  - commit+push (`72d769f`)
- **이용권에 brand(발급 클리닉) 필드 추가** — 프론트(앱) 연동 중 "GET /memberships 응답에 이 이용권이 어느 클리닉 것인지 필요하다"는 요청(위 자동 연결 기능으로 한 계정이 여러 클리닉 이용권을 가질 수 있게 되며 실제로 필요해짐)
  - 마이그레이션 `016_add_membership_brand.sql` — `memberships`/`emr_memberships`에 `brand text` 추가, 기존 행은 `membership_id`로 연결된 시술기록의 brand로 백필
  - `server_admin/patients.service.ts`(`createMembershipFromCareRecord`에 brand 파라미터 추가), `server/auth.service.ts`(claim 이관 시 `emr_memberships.brand`를 그대로 복사), `server/memberships.service.ts`(`GET /memberships` 응답에 `brand` 추가)
  - **순수 표시용** — 이용권 차감/자동 이어쓰기 매칭(`findContinuableMembership`)은 여전히 브랜드 무관(정책 변경 아님, 기존 "이용권은 클리닉 간 격리 안 됨" 유지)
  - Postgres DDL 직접 권한이 없어 마이그레이션 SQL은 사용자가 Supabase SQL Editor에서 직접 적용. 적용 후 검증하니 `memberships` 7개 중 4개가 백필 조인에서 빠짐(예전 데모 데이터가 `membership_id` FK 링크 없이 만들어진 케이스) — 각 소유자의 다른 시술기록 브랜드로 수동 백필해 0건으로 정리
  - 라이브 검증: 데모 계정 `GET /memberships` 응답에 `brand` 노출 확인 + AMRED 관리자로 신규 시술기록(새 이용권 생성) 등록 시 `membership.brand` 정상 기록 확인. 테스트 데이터/서버 정리
  - 문서: `docs/api-spec.md`/`.html`(v0.10→v0.11), `docs/db-schema.md`/`.html`(v0.8→v0.9) 갱신, 아티팩트 재발행
  - commit+push (`65e038b`)

## 현재 작업 중
- (없음 — 위 두 작업 전부 커밋+푸시 완료. 사용자가 "연동하면서 좀 더 있을텐데 모아서 보내드릴게요"라고 예고 — 프론트(진정님) 쪽 추가 요청이 배치로 들어올 예정, 다음 세션에 이어서 처리)

## 다음 할 일
- 프론트 연동 중 추가로 나올 요청 배치 대응 대기(예고됨, 아직 미수신)
- 클라이언트(앱) 회원가입 화면에 전화번호 입력란 추가 필요 — 프론트엔드는 사용자 담당 아님, 전달만 필요
- (README에 기록됨) 치료-부위 카탈로그가 시술기록 저장을 강제하지 않음 — 필요해지면 서버 레벨 검증 추가 검토
- (README에 기록됨) 이용권 자동 이어쓰기 매칭 정확도 — `product_name`+`total_count` 완전 일치만 인식
- (신규, 이번 세션 발견) 다중 클리닉 자동 연결은 이름+생년월일+전화번호 완전 일치로만 판별 — 클리닉마다 전화번호가 다르면(번호 변경 등) 연결 안 됨. 별도 대응 필요해지면 검토
- (신규, 이번 세션 발견) 다중 클리닉 자동 연결 안내(SMS 등)는 로그만 남기는 스텁 — 실제 발송 수단 미정, 필요해지면 SMS/이메일 인프라 재검토 필요(비용 이슈로 한 번 제거된 이력 있음)
- 가비아 클라우드 배포 — 크레딧 지급 조건 확인 후 진행 예정(아직 착수 전)
- (이월) 프론트 담당자 GitHub Collaborator 초대 미발송
- (이월) `.env` 비밀값을 프론트 담당자에게 git 아닌 채널로 전달
- (이월) 위험 신호 키워드 목록(`server/src/lib/riskKeywords.ts`) 전문가(의료진) 검수
- (이월) FCM 실제 발송 스케줄러 트리거 로직 미구현
- (이월) refreshToken 만료 정책 확정 미완료
- (이월) `docs/AAC_클리닉_자산_조사.docx` git 커밋 여부 여전히 미결정(untracked)
- (이월) admin-api-example.html "G. 예약 목록/취소" 섹션 실브라우저 클릭 검증 아직 안 됨

## 주요 파일
- `server_admin/src/services/patients.service.ts` — 환자/시술기록/이용권/방문통계/예약 전체 로직. **이번 세션 추가**: `findLinkedAccountFromOtherClinic`(타 클리닉 자동 연결 대상 조회), `maskAutoLinkedClaim`(응답 마스킹), `notifyExistingAccountLinked`(SMS 스텁), `createMembershipFromCareRecord`에 `brand` 파라미터
- `server/src/services/auth.service.ts` — `signup()`. **이번 세션 추가**: `migrateEmrDataToApp` 공용 함수 추출(형제 행에도 재사용), 형제 행 일괄 claim 로직
- `server/src/services/memberships.service.ts` — **이번 세션**: `GET /memberships` 응답에 `brand` 추가
- `server/db/migrations/016_add_membership_brand.sql` — **신규, 이번 세션**. Supabase에 적용 완료 + 백필 완료(수동 보정 포함)
- `docs/admin-api-spec.md`/`.html` — v0.6(이번 세션 갱신). 아티팩트: `743df35b-45c3-4c54-8214-75838c32181b`
- `docs/api-spec.md`/`.html` — v0.11(이번 세션 갱신). 아티팩트: `5cf6ed55-908b-4567-aa90-6357b35c52b6`
- `docs/db-schema.md`/`.html` — v0.9(이번 세션 갱신). 아티팩트: `f152ff3e-c2f7-4b36-b4ce-364667d3bf60`
- GitHub: https://github.com/WHS-After-Mate/Backend (main, 최신 push는 `65e038b`)

## 특이사항 / 결정 사항
- **다중 클리닉 자동 연결을 스키마 변경 없이 구현한 방법**: `created_at`과 `claimed_at`을 INSERT 시점에 의도적으로 완전히 같은 값으로 채워 "등록과 동시에 claim됨(=자동연결)"과 "나중에 정상 가입함"을 구분 — 신규 컬럼 없이 기존 두 타임스탬프의 관계만으로 마스킹 여부 판별. 비슷한 "신규 컬럼 없이 파생 판별" 패턴이 다시 필요하면 참고할 것
- **마스킹은 응답 표현에만 적용, DB/내부 로직엔 항상 실값 사용** — `GET /patients/{id}`의 `careRecords`/`memberships` 조회는 항상 진짜 `claimed_user_id`로 하고, 최종 `patient` 필드만 마스킹. 비슷하게 "이 클리닉엔 안 보여줘야 하지만 내부 로직은 정상 동작해야 하는" 요구가 또 나오면 이 분리 패턴(내부 조회는 unmask, 최종 응답만 mask) 재사용 가능
- **이 프로젝트는 Postgres DDL 직접 실행 권한이 없음(DATABASE_URL 미보유, service role key는 REST API 전용)** — 마이그레이션 SQL 파일은 작성해도 사용자가 Supabase SQL Editor에 직접 붙여넣어 실행해줘야 함. 앞으로도 스키마 변경(ALTER TABLE 등)이 필요하면 이 흐름(마이그레이션 파일 작성 → 사용자에게 적용 요청 → "다 했어" 확인 후 라이브 검증)을 그대로 따를 것
- **마이그레이션의 조인 기반 백필은 완벽하지 않을 수 있음** — 016에서 `membership_id` FK 링크가 없는 예전 데모 데이터가 백필에서 누락된 사례 발생. 앞으로 비슷한 백필 마이그레이션 작성 시, 적용 후 반드시 "백필 후 null 남은 행이 0개인지" 직접 쿼리로 확인하는 습관 유지할 것(이번엔 확인해서 잡아냄)
- **SMS/알림 발송 인프라는 여전히 미구현 상태 유지** — 비용 문제로 이미 한 번 통째로 제거된 이력이 있어(`server/README.md` TODO), 자동 연결 안내 등 새로 필요해진 곳에서도 로그만 남기는 스텁으로 처리하고 실제 재도입은 하지 않음(사용자가 명시적으로 "코드만 준비, 발송은 보류"라고 결정)
- **git-bash Bash 도구로 한글 payload를 다루면 인코딩이 깨짐** — `curl -d '...한글...'`이나 heredoc 직접 사용 금지. 항상 Write 도구로 파일을 작성한 뒤 `curl --data-binary @file.json`으로 ASCII-only 커맨드라인만 Bash에 전달할 것(이번 세션에도 재확인됨)
- **Windows에서 git-bash `/tmp`는 `C:\Users\PC\AppData\Local\Temp`로 매핑됨** — Bash로 쓴 파일을 PowerShell/Windows-native Node로 읽을 때 `/tmp/x.json` 대신 이 실제 경로를 써야 함(`cygpath -w /tmp`로 확인 가능). Python(cp949 기본 인코딩)으로 UTF-8 JSON 읽을 때도 인코딩 에러 남 — PowerShell의 `ConvertFrom-Json`을 쓰는 게 안전
- **claude-in-chrome 브라우저 확장이 이 환경에 연결 안 됨** — UI 변경 실브라우저 검증이 필요할 때 다음 세션에서 다시 시도해볼 것
- 세션 재시작 시 이 파일이 자동으로 브리핑됨(글로벌 CLAUDE.md 설정)
