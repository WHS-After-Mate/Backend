# After School 현재 상태
최종 업데이트: 2026-08-18 17:20

## 프로젝트 개요
WHS After Mate — AAC 웰니스 고객용 관리 이력·이용권 조회, LLM 기반 일차별 사후관리 안내·질문, 다음 관리 추천 MVP(3주 해커톤). 앱 클라이언트는 Android Studio(네이티브 Android, **프론트엔드는 사용자 담당 아님 — 이 세션에서 다루지 않음**), 고객용 백엔드(`server/`)는 Node.js + Express + TypeScript, DB/인증은 Supabase, **LLM은 OpenAI API(2026-08-18부터, 기존 Anthropic Claude에서 전환 — 해커톤 무료 크레딧)**, 푸시는 FCM. 관리자용 웹(`admin-web`, **별도 GitHub 저장소 — 이 백엔드 리포에서는 건드리지 않음**)과 그 백엔드(`server_admin/`, 이 리포에 포함)가 클리닉별 로그인 기반 가상 EMR 입력 도구로 자리잡았다.

## 완료된 작업
- **LLM 프로바이더 Anthropic Claude → OpenAI 전환** — 해커톤 무료 크레딧 활용 목적. `@anthropic-ai/sdk` 제거, `openai` SDK 설치. `server/src/config/anthropic.ts` 삭제 → `openai.ts` 신규. `env.ts`의 `ANTHROPIC_API_KEY`/`MODEL` → `OPENAI_API_KEY`/`MODEL`. `llm/client.ts`의 `callStructuredLlm`을 Anthropic tool_use → OpenAI function calling(`tool_choice:{type:"function"}`)으로 재작성(호출부 인터페이스는 그대로 유지해 다른 코드 무변경). `.env`/`.env.example`/`server/README.md`/`docs/llm-prompt-design.md`/`docs/frontend-integration-guide.md` 등 전부 갱신
  - **모델 선정을 실측 벤치마크로 결정** — 처음 `gpt-4o-mini`로 설정했으나 사용자가 "미니 말고 다른거 쓰자"고 요청 → 여러 모델을 실제 tool-call 방식으로 벤치마크: `gpt-5`/`gpt-5-mini`는 추론모델이라 `max_completion_tokens` 예산을 전부 내부 추론에 써버려 tool call을 아예 못 냄(13~19초, 완전 실패) → 부적합 확정. `gpt-5.6-luna`/`sol`/`terra`는 `reasoning_effort:"none"`을 명시해야만 동작하고 느리며(3.3~7.5초) 코드네임 네이밍이라 프로덕션 안정성 불확실 → 기각. **`gpt-5.4`가 가장 빠르고(실측 daily-guide 1.9초, questions 1.4초) 기본 파라미터로 안정적으로 tool call을 반환** → 최종 채택
  - GPT-5 계열은 `max_tokens`를 거부하고 `max_completion_tokens`만 지원한다는 것을 실측으로 발견 — `client.ts` 파라미터명 수정(구형 모델과도 호환 확인)
  - `npm run dev`로 실서버 기동 + 실제 daily-guide/questions 프롬프트로 종단 검증
- **dd.txt 프론트 요청 배치(6건) 처리** — 어제 예고됐던 "연동하면서 모아서 보내드릴게요" 배치
  1. `GET /care-records/:id` 응답 `membership`에 `totalCount` 추가
  2. `reference_guides`의 botox/filler/energy_lifting/skin_booster/hair_removal 5종을 기존 0-30 단일 스텁에서 0-1/2-3/4-7/8-14/15-30 5구간으로 세분화(25행). 옛 0-30 행을 안 지우면 `findReferenceGuide`의 `.maybeSingle()`이 다중매칭 에러로 daily-guide를 조용히 실패시키는 버그를 미리 발견해 시드 스크립트에 정리 로직 추가. `npm run seed` 재실행 + 실DB 조회로 25행 정확히 생성됐는지 검증
  3. **실제 버그 발견·수정**: "이용권 사용이력이 안 뜬다"는 신고(실사용자 오세훈 계정으로 직접 진단) → 회원가입(claim) 이관 시 `care_records.membership_id` 연결이 아예 빠지고 `membership_usages`도 안 채워지는 버그를 `server/auth.service.ts`(`migrateEmrDataToApp`)에서 발견. `server_admin`의 `addCareRecord`(재방문 시술기록 추가 경로)도 동일 버그 있어 같이 수정 + `DELETE /care-records`에 `membership_usages` 정리 로직 추가. 기존에 이미 깨져있던 데이터 3건(오세훈 포함) 백필 완료, 재조회로 확인
  4/5. **다음 관리 추천을 OpenAI 기반으로 전환** — 시술 후보 선정(관심목표/최근시술 매칭 점수)은 그대로 규칙 기반 유지, `reasons`/`detailDescription` 문구 생성만 `recommendation.prompt.ts`(신규) + OpenAI로 교체(시술마다 다른 문구 생성). 실패/키 미설정 시 기존 정적 템플릿으로 자동 폴백. 실제 계정(오세훈)으로 라이브 검증 — 부작용으로 `GET /next-care`/`GET /home/summary` 응답시간이 즉시 응답 → 약 4~6초로 증가(사용자에게 명확히 고지함)
  6. `GET /recommendations/next-care/:id` 응답 `relatedRecentCares[]`에 `brand` 추가
  - 부수적으로 **엑셀(`docs/care_procedure_template.xlsx`) vs DB `procedures` 테이블 완전성을 코드로 1:1 재검증** — 46건 전부 일치, 사업장·카테고리 태그 불일치 0건. `description` 15건은 줄바꿈/마크다운만 다듬어진 것(내용 손실 없음, 오히려 엑셀 원본의 잘린 문장 하나를 자연스럽게 완성해둔 것도 발견)
- **문서 동기화 + 아티팩트 재발행** — `docs/api-spec.md`/`.html`(v0.11→v0.12), `docs/admin-api-spec.md`/`.html`(v0.6→v0.7), `docs/llm-prompt-design.md`/`.html`(v0.1→v0.2, LLM 호출 지점 2곳→3곳으로 갱신). 아티팩트 3종(API 명세서 `5cf6ed55`, 관리자 API 명세서 `743df35b`, LLM 프롬프트 설계 `48a5799c`) WebFetch로 최신본 확인 후 재발행
- commit+push 완료 (`756fcb7`) — `docs/AAC_클리닉_자산_조사.docx`/`docs/WHS_After_Mate_Admin_revised.html`은 이번에도 무관해 제외

## 현재 작업 중
- (없음 — 위 작업 전부 커밋+푸시 완료)

## 다음 할 일
- (신규) `reference_guides` 5종의 세분화된 경과일 문구는 여전히 전문가(의료진) 미검수 잠정 문구 — 검수 필요(기존 미검수 이슈에 세분화만 추가된 상태)
- (신규) 추천 응답 지연(즉시→4~6초) 트레이드오프를 프론트(진정님)에게 전달했는지 확인 필요 — UI에 로딩 표시 필요할 수 있음
- (신규) `procedures.description`을 엑셀 원문 그대로(줄바꿈 유지)로 바꿀지, 지금처럼 다듬어진 프로즈 버전으로 유지할지 — 사용자에게 물어봤으나 아직 답변 없음
- 프론트 연동 중 추가로 나올 요청 배치 대응 대기(계속 이어질 수 있음)
- 클라이언트(앱) 회원가입 화면에 전화번호 입력란 추가 필요 — 프론트엔드는 사용자 담당 아님, 전달만 필요
- (README에 기록됨) 치료-부위 카탈로그가 시술기록 저장을 강제하지 않음 — 필요해지면 서버 레벨 검증 추가 검토
- (README에 기록됨) 이용권 자동 이어쓰기 매칭 정확도 — `product_name`+`total_count` 완전 일치만 인식
- 다중 클리닉 자동 연결은 이름+생년월일+전화번호 완전 일치로만 판별 — 클리닉마다 전화번호가 다르면(번호 변경 등) 연결 안 됨. 별도 대응 필요해지면 검토
- 다중 클리닉 자동 연결 안내(SMS 등)는 로그만 남기는 스텁 — 실제 발송 수단 미정, 필요해지면 SMS/이메일 인프라 재검토 필요(비용 이슈로 한 번 제거된 이력 있음)
- 가비아 클라우드 배포 — 크레딧 지급 조건 확인 후 진행 예정(아직 착수 전)
- (이월) 프론트 담당자 GitHub Collaborator 초대 미발송
- (이월) `.env` 비밀값을 프론트 담당자에게 git 아닌 채널로 전달
- (이월) 위험 신호 키워드 목록(`server/src/lib/riskKeywords.ts`) 전문가(의료진) 검수
- (이월) FCM 실제 발송 스케줄러 트리거 로직 미구현
- (이월) refreshToken 만료 정책 확정 미완료
- (이월) `docs/AAC_클리닉_자산_조사.docx` git 커밋 여부 여전히 미결정(untracked)
- (이월) admin-api-example.html "G. 예약 목록/취소" 섹션 실브라우저 클릭 검증 아직 안 됨

## 주요 파일
- `server/src/config/openai.ts` — **신규, 이번 세션**. `anthropic.ts` 대체, OpenAI 클라이언트 + `OPENAI_MODEL`(`gpt-5.4`) export
- `server/src/services/llm/client.ts` — **이번 세션**. `callStructuredLlm`을 OpenAI function calling으로 재작성(`max_completion_tokens` 사용). daily-guide/questions/recommendation 3곳 전부 이 함수 재사용
- `server/src/services/llm/recommendation.prompt.ts` — **신규, 이번 세션**. 추천 사유/설명 생성용 프롬프트+스키마
- `server/src/services/recommendations.service.ts` — **이번 세션**. `generateRecommendationCopy`로 OpenAI 연동(실패 시 템플릿 폴백), `relatedRecentCares`에 `brand` 추가
- `server/src/services/auth.service.ts` — **이번 세션 버그 수정**. `migrateEmrDataToApp`이 이제 이용권을 먼저 이관해 id 매핑을 만든 뒤 `care_records.membership_id`를 연결하고 `membership_usages`까지 채움
- `server_admin/src/services/patients.service.ts` — **이번 세션 버그 수정**. `addCareRecord`가 claim된 환자 시술기록 추가 시 `membership_usages`도 기록, 삭제 시 정리
- `server/src/services/careRecords.service.ts` — **이번 세션**. `membership.totalCount` 추가
- `server/db/seed/seed.ts` — **이번 세션**. `reference_guides` 5종을 5구간(0-1/2-3/4-7/8-14/15-30)으로 세분화 + 옛 0-30 행 정리 로직
- `docs/api-spec.md`/`.html` — v0.12(이번 세션 갱신). 아티팩트: `5cf6ed55-908b-4567-aa90-6357b35c52b6`
- `docs/admin-api-spec.md`/`.html` — v0.7(이번 세션 갱신). 아티팩트: `743df35b-45c3-4c54-8214-75838c32181b`
- `docs/llm-prompt-design.md`/`.html` — v0.2(이번 세션 갱신). 아티팩트: `48a5799c-bcb7-497e-b670-da211a14b1be`
- GitHub: https://github.com/WHS-After-Mate/Backend (main, 최신 push는 `756fcb7`)

## 특이사항 / 결정 사항
- **`OPENAI_MODEL` 기본값은 `gpt-5.4`로 확정** — 실측 벤치마크 근거(위 완료된 작업 참고). 향후 다른 GPT-5 계열 모델로 바꿀 일이 있으면, 그 모델이 추론모델(`gpt-5`/`gpt-5-mini` 같은)인지 먼저 확인할 것 — 추론모델은 강제 `tool_choice` 구조화 출력과 궁합이 안 좋아 우리 파이프라인(daily-guide/questions/recommendation 전부)에서 실패한다
- **GPT-5 계열은 `max_tokens`가 아니라 `max_completion_tokens`를 써야 함** — 구형 모델(`gpt-4o` 등)에서도 `max_completion_tokens`가 호환되는 것 확인했으므로 코드에서는 이 파라미터명으로 통일
- **`membership_usages`는 claim 이관(`auth.service.ts`)과 재방문 시술기록 추가(`server_admin`) 두 경로에서만 채워짐** — `emr_memberships`(claim 전 스테이징)는 대상 아님, FK가 앱 테이블 `memberships`만 참조하기 때문. 비슷한 "회원가입 이관 시 놓치기 쉬운 연결" 버그가 또 있을 수 있으니, claim 관련 새 기능을 만들 때 `migrateEmrDataToApp`을 참고 템플릿으로 삼을 것
- **추천 LLM화로 인한 응답 지연(4~6초)은 사용자가 명확히 인지한 상태로 진행 결정** — "LLM으로 전환" 확답을 AskUserQuestion으로 받은 뒤 구현, 트레이드오프도 별도로 강조해 전달함
- **git-bash Bash 도구로 한글 payload를 다루면 인코딩이 깨짐** — `curl -d '...한글...'`이나 heredoc 직접 사용 금지. Write 도구로 파일을 작성한 뒤 `curl --data-binary @file.json`으로 ASCII-only 커맨드라인만 Bash에 전달할 것
- **Windows git-bash에서 python3는 MS Store stub이라 openpyxl 등 패키지가 없음** — `/c/Users/PC/anaconda3/python`을 명시적으로 써야 pandas/openpyxl 등 실제 패키지 사용 가능(이번 세션에 엑셀 대조 작업에서 확인)
- **claude-in-chrome 브라우저 확장이 이 환경에 연결 안 됨** — UI 변경 실브라우저 검증이 필요할 때 다음 세션에서 다시 시도해볼 것
- 세션 재시작 시 이 파일이 자동으로 브리핑됨(글로벌 CLAUDE.md 설정)
