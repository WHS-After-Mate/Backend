# After School 현재 상태
최종 업데이트: 2026-08-20 (8, 추천 알고리즘 tie-break 버그 수정 + 시술명 정식화)

## 프로젝트 개요
WHS After Mate — AAC 웰니스 고객용 관리 이력·이용권 조회, LLM 기반 일차별 사후관리 안내·질문, 다음 관리 추천 MVP(3주 해커톤). 앱 클라이언트는 Android Studio(네이티브, **프론트엔드는 사용자 담당 아님**), 고객용 백엔드(`server/`)는 Node.js + Express + TypeScript, DB/인증은 Supabase, **LLM은 OpenAI API**(`gpt-4.1-mini`), 푸시는 FCM. 관리자용 웹(`admin-web`, 별도 저장소, **임시/프로토타입 취급**)과 그 백엔드(`server_admin/`, 이 리포 포함)가 클리닉별 로그인 기반 가상 EMR 입력 도구. **가비아 클라우드에 실제 배포됨**(`1.201.116.115`, 2026-08-18~8/28 한시 운영) — 두 프론트팀(Android/admin-web)이 이 서버를 baseUrl로 쓰고 있음.

## 완료된 작업
- **(7) 세션 — 예약 미차감/브랜드 격리/문서 동기화 배치 커밋+배포 완료** (`c676a67`~`fd9fa30`, 이번 세션 시작 시점에 이미 origin에 반영돼 있었음 확인): 시술기록 `careDate`가 오늘(KST)일 때만 이용권 차감(마이그레이션 026 `session_consumed`), 이용권 소비 상태 변경 시 `session_number` 재동기화, `getLatestCareRecord`가 미래 예약 제외, 전화번호 중복 등록 차단(`PHONE_ALREADY_REGISTERED`), FCM 발송 실패 로깅, 문서 4종(admin-api-spec v0.11/db-schema v0.11/api-spec v0.17/server-code-guide v0.5) + 아티팩트 재배포
- **다음 관리 추천이 관심목표를 바꿔도 항상 같은 시술로 나오던 버그 수정** — 사용자가 "오세훈 다음 관리 추천이 관심 시술을 바꿔도 항상 동일해" 질문 → `recommendations.service.ts`의 `scoreProcedures` 동률 처리 원인 재현·확정: `goalOverlap`(관심목표 겹침 개수)이 거의 항상 1로 동률이 나서, 동률 비교에 쓰던 `recentRelevance`(시술이 가진 태그 **전체**의 최근 이력)가 사실상 승부를 갈랐는데, 이건 관심목표와 무관한 값이라 최근 이력이 특정 카테고리(리프팅 등)에 몰린 고객은 관심목표를 뭘로 바꾸든 그 카테고리를 겸하는 "제너럴리스트" 시술(오세훈 계정에선 `리투오`)이 항상 1등으로 뽑혔음
  - 동률 비교를 **관심목표와 겹치는 태그만**의 최근 이력(`goalRelevance`)으로 교체, 그다음 `category_tags` 개수가 적은(더 특정) 시술 우선, 그래도 동률이면 이름순
  - 실제 오세훈 계정 데이터로 재현 검증: 관심목표 10종 단독 테스트 시 수정 전엔 3개가 전부 `리투오`로 수렴했는데 수정 후 10개 전부 서로 다른 시술로 분리됨 확인
- **`treatment_catalog` 시술명 표기 불일치 해소** (이월 항목이었음) — DB를 직접 조회해 실제 상태 확인한 결과, `treatment_catalog`/`procedures`/`treatment_guides`(시드+DB)는 간략화된 이름(`튠 콩피에르(Tune Confier)`/`레이저 제모`)을 쓰는데, 실제 EMR 이관 데이터(`emr_care_records`)와 실제 고객 시술기록(`care_records`, 1건 실사용 중)은 정식 명칭(`튠 콩피에르®`/`레이저 제모 솔루션`)을 쓰고 있어서 이미 그 1건의 daily-guide가 살아있는 404 버그였음을 발견
  - 정식 명칭으로 통일 결정(사용자 확인) — 시드 스크립트 3개(`server/db/seed/seedCareCatalog.ts`, `seedTreatmentGuides.ts`, `server_admin/db/seed/seedTreatmentCatalogFull.ts`) 수정 + DB 14행(treatment_catalog 2, procedures 2, treatment_guides 10) 직접 UPDATE로 반영, 재조회로 daily-guide 매칭 정상화 확인
- **문서 동기화 + 커밋+푸시+배포** — `docs/api-spec.md`(v0.17→v0.18, 매칭 알고리즘 tie-break 절 추가)/`docs/llm-prompt-design.md`(v0.5→v0.6, "이름 불일치" 미확정 항목 해소로 갱신), `.html` 2종도 동기화(fork 위임이 auto-mode classifier에 막혀 직접 수정) 후 아티팩트 재배포. 커밋(`3ec9160`)+푸시 완료, 사용자가 가비아 서버에 `git pull && npm install && npm run build && pm2 restart`(server/server_admin 둘 다) 실행해 배포 완료 확인(원격 curl 접근 불가라 직접 검증은 못 했으나 로컬 DB 기준 검증 + 정상 기동 확인으로 충분하다고 사용자 판단)

## 다음 할 일
- 위험 신호 키워드 목록(`server/src/lib/riskKeywords.ts`) 전문가 검수(이월)
- refreshToken 만료 정책 확정 미완료(이월)
- admin-web의 이용권 자동서치 미구현은 "임시 프로토타입이라 안 고쳐도 됨"으로 사용자가 결정 — 별도 후속 조치 불필요(참고용으로만 기록)
- `docs/image.png`는 사용자가 가비아 서버 터미널 스크린샷을 붙여넣는 스크래치 파일(문서 자산 아님) — 계속 커밋 대상에서 제외
- 미추적 파일(관례상 커밋 제외 중): `docs/AAC_클리닉_자산_조사.docx`, `docs/WHS_After_Mate_Admin_revised.html`

## 주요 파일
- `server/src/services/recommendations.service.ts` — **이번 세션**. `scoreProcedures()` 동률 비교를 `goalRelevance`(관심목표 겹치는 태그만의 최근 이력) 기준으로 교체, `category_tags.length`/이름 tiebreak 추가
- `server/db/seed/seedCareCatalog.ts`, `server/db/seed/seedTreatmentGuides.ts`, `server_admin/db/seed/seedTreatmentCatalogFull.ts` — **이번 세션**. 시술명 2건 정식 명칭으로 통일(`튠 콩피에르®`/`레이저 제모 솔루션`)
- `docs/api-spec.md`/`.html` — v0.18(추천 매칭 알고리즘 tie-break 변경 반영). `docs/llm-prompt-design.md`/`.html` — v0.6(이름 불일치 해소)
- GitHub: https://github.com/WHS-After-Mate/Backend (main, 최신 push는 `3ec9160`)
- 배포 서버: 가비아 클라우드 `1.201.116.115` — `~/Backend`에 git clone, pm2 프로세스명 `whs-server`(4000, server용)/`whs-admin`(4100, server_admin용). 이번 세션 변경까지 배포 완료(사용자 확인, 직접 curl 검증은 이 환경에서 외부 IP 아웃바운드가 막혀 있어 불가능함을 확인)

## 특이사항 / 결정 사항
- **이 환경에서 가비아 서버(`1.201.116.115`)로 직접 curl/네트워크 접근이 안 됨** — 아웃바운드 연결 자체가 타임아웃남(SSH 불가와는 별개 제약). 배포 검증은 사용자가 서버 터미널에서 `pm2 list`/`pm2 logs` 등을 직접 실행해 결과를 알려주거나 `docs/image.png`에 스크린샷을 붙여주는 방식으로만 가능
- **`recommendations.service.ts`의 동률 처리 설계 원칙**: `goalOverlap`(관심목표 겹침 개수)이 1차 기준이지만 대부분의 시술이 태그 1~2개뿐이라 사실상 거의 항상 동률 — 이 동률을 어떻게 깨는지가 추천 결과의 실질적 다양성을 결정한다는 게 이번에 드러난 핵심 교훈. "전체 최근 이력"이 아니라 "관심목표와 겹치는 태그의 최근 이력"으로 좁혀야 관심목표 변경이 실제로 체감되는 추천 변화를 만든다
- **fork로 위임 시도가 auto-mode classifier에 막힘** — HTML 문서 동기화+아티팩트 재배포를 fork에 위임하려 했으나 Agent 호출 자체가 차단됨(백그라운드 자율 작업으로 판단된 듯). 이번엔 직접 처리로 우회했음 — 앞으로 비슷한 상황에서는 처음부터 직접 처리를 고려할 것
- **`treatment_catalog`/`procedures`/`treatment_guides` DB 데이터를 시드 스크립트 재실행이 아니라 직접 UPDATE로 수정** — 세 테이블 다 `upsert(onConflict: name/care_name 등)` 패턴이라 이름을 바꾼 시드를 재실행하면 새 이름으로 INSERT되고 옛 이름 행이 고아로 남는 문제가 있어, 대신 이름만 바꾸는 1회성 UPDATE 스크립트로 안전하게 처리(작업 후 스크립트 파일 삭제)
- **커밋 전 항상 사용자에게 확인** — 세션 규칙으로 고정
- **가비아 서버 root 비밀번호는 어디에도 기록돼 있지 않음**(의도적으로 저장 안 함) — 필요시 가비아 콘솔에서 직접 확인해야 함
- 세션 재시작 시 이 파일이 자동으로 브리핑됨(글로벌 CLAUDE.md 설정)
