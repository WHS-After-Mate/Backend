# After School 현재 상태
최종 업데이트: 2026-08-19 03:20

## 프로젝트 개요
WHS After Mate — AAC 웰니스 고객용 관리 이력·이용권 조회, LLM 기반 일차별 사후관리 안내·질문, 다음 관리 추천 MVP(3주 해커톤). 앱 클라이언트는 Android Studio(네이티브, **프론트엔드는 사용자 담당 아님**), 고객용 백엔드(`server/`)는 Node.js + Express + TypeScript, DB/인증은 Supabase, **LLM은 OpenAI API**(`gpt-4.1-mini`), 푸시는 FCM. 관리자용 웹(`admin-web`, 별도 저장소)과 그 백엔드(`server_admin/`, 이 리포 포함)가 클리닉별 로그인 기반 가상 EMR 입력 도구. **가비아 클라우드에 실제 배포됨**(`1.201.116.115`, 2026-08-18~8/28 한시 운영) — 두 프론트팀(Android/admin-web)이 이 서버를 baseUrl로 쓰고 있음.

## 완료된 작업
- **추천 상세 응답 필드 `popularWithSimilarCustomers` → `categoryTags`로 교체** (이번 세션) — 사용자가 "쓸 일이 없다"고 판단해 제거 요청 + 대신 엑셀(`docs/care_procedure_template.xlsx`)에서 시술마다 O로 표시된 관심목표 칼럼을 응답에 노출해달라고 요청. `server/src/services/recommendations.service.ts`의 `getNextCareRecommendationDetail()`에서 "태그를 공유하는 다른 시술명 3개를 새로 계산"하던 로직을 삭제하고, 추천된 시술 자신의 `procedures.category_tags`(이미 시딩 시점에 엑셀 O 표시를 그대로 옮겨둔 값)를 그대로 `categoryTags` 필드로 반환하도록 단순화. `tsc --noEmit` 통과 확인. `docs/api-spec.md`/`.html`(v0.14→v0.15), `docs/db-schema.md`/`.html`, `server/README.md` changelog까지 문서 동기화 완료
- **OpenAI 모델 최종 확정: `gpt-4.1-mini`** — 처음 `gpt-4o-mini` → "미니 말고 다른거" 요청으로 `gpt-5.4`로 변경(벤치마크상 가장 빠름) → **배포 후 실사용자 신고("홈/추천 화면 로딩 30초 넘게 안 뜸")로 심각한 버그 발견**: `gpt-5.4`가 계정 기준 **일일 50 요청 하드 레이트리밋**에 걸려있었고, OpenAI SDK 기본 재시도(`maxRetries:2`)가 앱 자체 재시도 루프와 중첩돼 24초까지 응답이 늘어짐 → `gpt-4.1-mini`로 최종 교체(레이트리밋 없음) + `server/src/config/openai.ts`에 `maxRetries:0` 추가로 SDK 재시도 자체를 꺼서 재발 방지. 벤치마크: 24132ms → 1381ms
- **가비아 클라우드 배포 완료**(사용자와 단계별로 확인해가며 진행) — 서버 생성, Node/git 설치, `.env` 구성, pm2로 `server`(4000)/`server_admin`(4100) 구동, nginx로 `/`→4000, `/admin-api`→4100 경로 분기, 보안그룹 80/22 오픈, fail2ban으로 SSH 브루트포스 방어. `package.json`의 `main`/`start` 경로 버그(`dist/server.js`→`dist/src/server.js`, `rootDir` 설정 때문) 수정. 두 프론트팀에게 각자 baseUrl 문서 전달(`frontend-integration-guide.md`: Android용 `/api/v1`, `admin-api-spec.md`: admin-web용 `/admin-api/api/v1`)
- **membership_usages 실버그 수정** — 실사용자 오세훈 계정에서 "이용권 사용이력이 안 뜬다" 신고 → claim 이관(`auth.service.ts`)과 재방문 시술기록 추가(`server_admin`) 양쪽에서 `membership_usages`를 안 채우던 버그, 기존 데이터 백필까지 완료
- **`GET /visit-stats` 의미 변경** — 전날/금일 카운트를 "방문(시술기록 있음)"에서 **"신규 등록(환자번호 최초 발급)"**으로 변경(`server_admin/patients.service.ts`의 `getVisitStats`). 익일(예약)은 기존 방식 유지. `admin-api-spec.md`/`.html` v0.8로 반영
- **사후관리 레퍼런스 콘텐츠 재작성** — dd.txt 피드백("내용이 너무 뻔하다") 반영해 `energy_lifting`/`botox`/`filler`/`skin_booster`/`hair_removal` 5종 × 5구간(0-1/2-3/4-7/8-14/15-30) 문구를 전문적인 내용으로 재작성(`seed.ts`)
- **`docs/prompt.docx`(사용자 팀 작성 프롬프트 재설계안) 전체 반영** — recommendation.prompt.ts(few-shot 예시 반전), questions.prompt.ts(`consultationLevel` 추가), dailyGuide.prompt.ts(근거 원칙 폐기, `precautions`/`aftercare`/`keyCare` 전면 교체) 세 프롬프트 전면 재작성 + 라이브 검증 완료
- **문서 동기화 + 아티팩트 재발행** — `docs/api-spec.md`/`.html`, `docs/admin-api-spec.md`/`.html`, `docs/llm-prompt-design.md`/`.html`
- commit+push 완료 (`1de2080`) — `docs/prompt.docx` 포함

## 현재 작업 중
- **categoryTags 변경 아직 커밋 전** — 코드/문서 수정은 끝났고 typecheck도 통과했지만 아직 git commit/push 안 함(사용자 확인 대기)
- **🚨 (이전 세션부터 이월, 이번 세션엔 미확인) 배포 서버(가비아) 코드가 최신 반영 안 됐을 가능성** — DB 마이그레이션 017/018은 공유 Supabase에 적용됐는데 배포 서버 코드가 예전 버전이라 컬럼 불일치로 `GET /aftercare/daily-guide` 503, `GET /home/summary`의 `aftercareCard: null` 발생했었음. 사용자에게 `git pull && npm run build && pm2 restart whs-server` 요청했었으나 **실행 여부 이번 세션에서 재확인 안 함**

## 다음 할 일
- categoryTags 변경 커밋 여부 사용자에게 확인 후 commit+push
- **최우선(이월)**: 배포 서버 `git pull` + 빌드 + `pm2 restart whs-server` 완료 여부 확인 — 안 됐다면 지금 이 세션의 categoryTags 변경도 함께 배포해야 함
- 배포 서버 재기동 후 실제 curl로 `GET /aftercare/daily-guide`/`GET /home/summary`/`GET /recommendations/next-care/{id}`(categoryTags 포함 여부) 재검증
- `treatment_catalog`의 `botox` care_type 분리(근육형/피부형) — 아직 미착수
- `treatment_catalog` 시술명 2건 오타/불일치(`튠 콩피에르®`, `레이저 제모 솔루션`) 실제 엑셀 원본과 맞출지 결정 필요
- questions.prompt는 여전히 `reference_guides`(미검수 5종 포함)를 `reviewedGuide`로 주입 중 — 근거 원칙 바꿀지 미정
- `reference_guides` 미검수 스텁 전문가 검수 여전히 필요
- 위험 신호 키워드 목록(`server/src/lib/riskKeywords.ts`) 전문가 검수 (이월)
- `docs/image.png`가 원인불명으로 변경돼 있음(171KB→13KB) — 여전히 미해결, 커밋 대상에서 계속 제외 중
- 미추적 파일(8/18부터 관례상 커밋 제외 중): `docs/AAC_클리닉_자산_조사.docx`, `docs/WHS_After_Mate_Admin_revised.html` — 이번 세션에도 그대로 둠
- FCM 실제 발송 스케줄러 트리거 로직 미구현 (이월)
- refreshToken 만료 정책 확정 미완료 (이월)

## 주요 파일
- `server/src/services/recommendations.service.ts` — **이번 세션**. `categoryTags` 필드로 교체(구 `popularWithSimilarCustomers`)
- `server/src/services/careCatalog.service.ts` — `procedures.category_tags` 조회(`listAllProcedures`) — categoryTags 값의 실제 출처
- `server/db/seed/seedCareCatalog.ts` — 엑셀 O 표시를 옮겨 담은 `PROCEDURES[].tags` 원본 데이터
- `server/src/config/openai.ts` — `OPENAI_MODEL` 기본값 `gpt-4.1-mini`, `maxRetries: 0`
- `server/src/services/llm/dailyGuide.prompt.ts` / `questions.prompt.ts` / `recommendation.prompt.ts` — `docs/prompt.docx` 반영 재작성
- `server/db/migrations/017_add_question_consultation_level.sql`, `018_daily_guide_docx_redesign.sql` — 적용 완료(공유 Supabase)
- `docs/api-spec.md`/`.html` — v0.15. `docs/admin-api-spec.md`/`.html` — v0.8. `docs/db-schema.md`/`.html`, `server/README.md`도 이번 세션에 함께 갱신
- GitHub: https://github.com/WHS-After-Mate/Backend (main, 최신 push는 `1de2080` — 이번 세션 변경분은 아직 미푸시)
- 배포 서버: 가비아 클라우드 `1.201.116.115` — `~/Backend`에 git clone, pm2 프로세스명 `whs-server`(4000)/`server_admin` 쪽 프로세스명은 미기록, nginx가 `/admin-api` 접두사 라우팅

## 특이사항 / 결정 사항
- **`categoryTags`는 새 계산이 아니라 기존 데이터 노출** — `procedures.category_tags`는 원래도 추천 매칭(관심목표·최근시술 연관성 스코어링)에 쓰이고 있던 값이라, 이번 변경은 그 값을 상세 응답 필드로도 그대로 내려주기만 하면 됐음. 프론트/다른 코드에서 `popularWithSimilarCustomers`를 참조하는 곳 없음을 확인 후 제거
- **daily-guide의 "검수된 가이드만 근거" 원칙을 폐기한 이유**: `reference_guides`의 `botox` care_type이 근육 주입형과 피부층 주입형이라는 서로 다른 시술을 같은 문구로 묶고 있었음 — LLM이 시술명·환자 정보를 보고 직접 판단하게 하는 쪽으로 설계 변경
- **API 필드명 변경은 하위호환 없음이 이 프로젝트의 관례** — `mustAvoid`/`basicCare`→`precautions`/`aftercare`, 이번 `popularWithSimilarCustomers`→`categoryTags`도 동일 기조. Android 프론트가 구 필드명을 참조 중이면 갱신 필요(전달 여부 미확인)
- **배포 서버에 DB 마이그레이션과 코드 배포 사이에 시차가 생기면 바로 장애로 이어짐** — 실제로 겪은 사례 있음. 스키마 변경 수반 작업은 "마이그레이션 적용 확인 → 즉시 배포 서버도 함께 갱신"을 한 세트로 처리할 것
- **커밋 전 항상 사용자에게 확인** — 세션 규칙으로 고정(사용자가 명시적으로 교정한 적 있음). 원인 불명 변경분(`docs/image.png`)은 임의로 커밋에 포함하지 않고 먼저 물어봄
- 가비아 서버 root 비밀번호는 어디에도 기록돼 있지 않음(의도적으로 저장 안 함) — 필요시 가비아 콘솔에서 직접 확인해야 함
- 세션 재시작 시 이 파일이 자동으로 브리핑됨(글로벌 CLAUDE.md 설정)
