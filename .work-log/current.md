# After School 현재 상태
최종 업데이트: 2026-08-16 03:20

## 프로젝트 개요
WHS After Mate — AAC 웰니스 고객용 관리 이력·이용권 조회, LLM 기반 일차별 사후관리 안내·질문, 다음 관리 추천 MVP(3주 해커톤). 앱 클라이언트는 Android Studio(네이티브 Android), 고객용 백엔드(`server/`)는 Node.js + Express + TypeScript, DB/인증은 Supabase, LLM은 Anthropic Claude API, 푸시는 FCM. 관리자용 웹(`admin-web`, **별도 GitHub 저장소 — 이 백엔드 리포에서는 건드리지 않음**)과 그 백엔드(`server_admin/`, 이 리포에 포함)가 클리닉별 로그인 기반 가상 EMR 입력 도구로 자리잡았다.

## 완료된 작업
- **재방문(이미 회원가입한) 고객 시술기록 등록 허용** — 예전엔 claim된 환자에 새 시술기록 추가가 `409 PATIENT_ALREADY_CLAIMED`로 막혔는데, claim 여부와 무관하게 항상 기록 가능하도록 전면 수정. claim 전이면 `emr_care_records`/`emr_memberships`(스테이징), claim 후면 실제 `care_records`/`memberships`에 곧바로 기록(`patients.service.ts`의 `addCareRecord`가 `claimed_user_id` 유무로 분기). 응답/조회에 `source`("emr"|"app") 파생 필드 추가
- **`GET /visit-stats` 신규** — 오늘/어제/이틀 전(KST) 로그인 클리닉 방문 고객 수(중복 제거). emr_care_records+care_records 양쪽을 `claimed_user_id`로 신원 통합해 집계(당일 가입 케이스의 이중 카운트 버그를 실측으로 발견해 수정)
- **환자 등록 시 중복 처리** — 같은 클리닉에 이름+생년월일+전화번호가 전부 일치하는 환자가 이미 있으면 새로 만들지 않고 재사용, `notes`가 다르면 그 자리에서 갱신 후 `200`+`duplicate:true`+안내 메시지로 응답(처음엔 `409` 에러로 설계했다가 사용자 피드백으로 "성공 처리+메시지"로 변경)
- **`docs/admin-api-spec.md`/`.html` 전면 동기화** — 위 변경사항 전부 반영(DB 절, Response 필드 표, 통계 섹션 신설, 알려진 제한사항 갱신), 아티팩트 재발행 완료(https://claude.ai/code/artifact/743df35b-45c3-4c54-8214-75838c32181b)
- **미커밋 대량 작업 커밋+푸시 완료** (`fea1b9a`) — 클리닉 관리자 로그인, EMR 스테이징 테이블, store 제거+brand 격리, 시술기록/이용권 통합, 관리 부위 배열, 위 재방문/통계/중복처리 전부 포함해 41개 파일. `docs/AAC_클리닉_자산_조사.docx`는 이번에도 커밋 여부 미결정이라 제외
- **dd.txt 미결정 항목 3개 결정 및 구현**:
  - 항목4(인증코드→이름+생년월일 신원확인)는 이미 구현되어 있었음을 확인
  - 항목5: 회원가입에 `interestGoals`(관심목표, 중복선택) 추가 — `POST /auth/signup`이 그 자리에서 `profiles.interest_goals`에 저장(생략 시 빈 배열)
  - 항목7: 비밀번호 재설정을 이메일 링크(`recoveryToken`) 방식에서 숫자 인증코드(`{email, code, newPassword}`) 방식으로 전환. `code`는 Supabase `auth.verifyOtp({ email, token: code, type: "recovery" })`로 검증
- **Resend 커스텀 SMTP 연동 + Reset Password 이메일 템플릿에 `{{ .Token }}` 추가** — Supabase는 커스텀 SMTP 없이는 이메일 템플릿 편집(Source 탭) 자체가 막혀있다는 걸 브라우저로 직접 확인 후 해결. 브라우저 자동화로 Supabase SMTP Settings(Host/Port/Username 등 비밀 아닌 값은 직접 입력)까지 진행, API 키/비밀번호는 사용자가 직접 입력(자격증명이라 대신 입력 안 함)
- **비밀번호 재설정 전체 플로우 실사용 이메일로 라이브 종단 검증** — `yongsang0615@gmail.com` 계정으로 reset-request→실제 메일 수신→코드로 reset-confirm→새 비밀번호 로그인까지 확인. 이 과정에서 **인증코드가 "6자리"라는 가정이 틀렸음을 발견**(이 프로젝트는 실측 8자리, Supabase 프로젝트 설정에 따라 다름) → `passwordResetConfirmSchema` 정규식을 `/^\d{6}$/`에서 `/^\d{6,10}$/`로 완화, 테스트 페이지의 `maxlength="6"` 버그도 수정, `docs/api-spec.md`/`.html`·`server/README.md`의 모든 "6자리" 문구를 정정
- **`docs/api-spec.md`/`.html`의 "인증/온보딩" 섹션 전체 재동기화** — 예전 verificationCode(인증코드) 기반 설계가 실제 코드(patientNo+이름+생년월일) 변경 이후에도 문서에 방치돼 있던 걸 발견해 전면 수정. `signup_verification_codes` 테이블 삭제, `PATIENT_IDENTITY_MISMATCH` 에러코드 등 반영
- 테스트한 시나리오는 전부 실서버 기동+curl(+실제 이메일 수신)로 라이브 검증, 테스트 데이터/계정은 즉시 정리. `server`/`server_admin` 양쪽 typecheck/build 통과 유지

## 현재 작업 중
- (없음 — 이번 세션 작업은 전부 실측 검증까지 완료된 상태. **단, 최신 라운드(interestGoals/비밀번호 재설정 코드화/문서 재동기화/OTP 자릿수 수정)는 아직 git commit 안 함**, 사용자가 실제 비밀번호를 원래대로 되돌리는 중)

## 다음 할 일
- **git add/commit/push** — 최신 변경분(`docs/api-spec.md`/`.html`, `server/README.md`, `server/src/config/env.ts`, `server/src/examples/api-call-example.html`, `server/src/lib/errors.ts`, `server/src/routes/auth.routes.ts`, `server/src/services/auth.service.ts`, `server/src/validators/auth.validators.ts`) 미커밋 상태 — 다음 세션 시작 시 우선 처리
- Resend 발신 주소가 아직 테스트 도메인(`onboarding@resend.dev`)이라 **Resend 계정 소유자 본인 이메일로만 발송 가능** — 실제 사용자 전체 대상으로 열려면 커스텀 도메인을 Resend에 등록·인증해야 함
- `docs/db-schema.md`/`.html`, `docs/server-code-guide.md`/`.html`, `docs/llm-prompt-design.html` — 여전히 최근 세션들의 백엔드 변경사항과 미동기화(오래된 backlog, admin-api-spec/api-spec만 이번에 동기화됨)
- 가비아 클라우드 배포 — 크레딧 지급 조건 확인 후 진행 예정(아직 착수 전)
- (이월) 프론트 담당자 GitHub Collaborator 초대 미발송
- (이월) `.env` 비밀값을 프론트 담당자에게 git 아닌 채널로 전달
- (이월) 위험 신호 키워드 목록(`server/src/lib/riskKeywords.ts`) 전문가(의료진) 검수
- (이월) FCM 실제 발송 스케줄러 트리거 로직 미구현
- (이월) refreshToken 만료 정책 확정 미완료
- (이월) `docs/AAC_클리닉_자산_조사.docx` git 커밋 여부 여전히 미결정(untracked)

## 주요 파일
- `server_admin/src/services/patients.service.ts` — 환자/시술기록/이용권/방문통계 전체 로직. claim 여부 분기(emr_* vs 실제 테이블), 중복 환자 재사용+notes 갱신, `getVisitStats`
- `server_admin/src/routes/patients.routes.ts` — `GET /visit-stats` 포함 전체 라우트
- `server/src/services/auth.service.ts` — `signup()`(interestGoals 포함), `requestPasswordReset`/`confirmPasswordReset`(숫자 코드 방식)
- `server/src/validators/auth.validators.ts` — `signupSchema`(interestGoals), `passwordResetConfirmSchema`(email+code, 6~10자리)
- `docs/admin-api-spec.md`/`.html` — server_admin 전체 API 명세, 아티팩트로도 발행됨
- `docs/api-spec.md`/`.html` — 고객용 server/ API 명세, 이번 세션에 인증/온보딩 섹션 재동기화
- `server_admin/README.md`, `server/README.md` — 각각 엔드포인트 요약 및 구현 노트, 이번 세션 반영분 포함
- GitHub: https://github.com/WHS-After-Mate/Backend (main, 최신 push는 `fea1b9a` — 이후 변경분은 미커밋)

## 특이사항 / 결정 사항
- **claim(회원가입) 이후에도 시술기록 등록 가능하도록 설계 전환** — 예전엔 claim 후 EMR 갱신을 막았는데, 재방문 고객을 기록할 방법이 없어지는 문제라 사용자가 명시적으로 뒤집음("앱을 가입했어도 시술기록은 추가가 되는거지?"). claim 시점의 1회성 이관 자체는 유지, 이후 기록만 실제 앱 테이블로 직행
- **환자 중복 등록 처리: 에러가 아니라 "성공+안내"로 설계** — 처음엔 `409` 에러로 막는 설계였는데, 사용자가 "기타사항이 바뀌었을 수도 있으니 반영은 안 되냐"고 질문 → notes 자동 갱신 + `200`+`duplicate:true`로 재설계(사용자가 상태코드까지 직접 "성공이긴 한데 중복이라고 메시지는 나오게" 지정)
- **비밀번호 재설정 인증코드는 표준 "6자리"가 아님** — Supabase 프로젝트 설정에 따라 자릿수가 달라질 수 있고 이 프로젝트는 실측 8자리. 이 프로젝트 관련 문서/검증 로직에 자릿수를 하드코딩하지 말 것(6~10자리로 느슨하게 검증)
- **Supabase는 커스텀 SMTP 없이 이메일 템플릿 편집 자체가 불가능** — "Source 탭이 안 눌러진다"는 사용자 보고를 브라우저로 직접 확인해서 발견. 커스텀 SMTP(Resend) 연동이 선행 조건이었음(기존 README TODO와 동일 항목이었는데 사전에 인지 못하고 있었음)
- **자격증명은 절대 대신 입력하지 않음** — Resend API 키, Supabase SMTP Password 필드는 사용자가 직접 입력하도록 안내만 하고, 나머지 비밀 아닌 필드(Host/Port/Username/Sender 등)만 브라우저 자동화로 채움
- **Windows tsx watch 재시작 이슈** — 여전히 유효, `npm run build` 후 `node dist/src/server.js` 권장
- 세션 재시작 시 이 파일이 자동으로 브리핑됨(글로벌 CLAUDE.md 설정)
