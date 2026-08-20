# After School 현재 상태
최종 업데이트: 2026-08-20 (9, git pull 반영 브리핑 + 관심목표 기반 추천 + 회원 탈퇴 API 신규)

## 프로젝트 개요
WHS After Mate — AAC 웰니스 고객용 관리 이력·이용권 조회, LLM 기반 일차별 사후관리 안내·질문, 다음 관리 추천 MVP(3주 해커톤). 앱 클라이언트는 Android Studio(네이티브, **프론트엔드는 사용자 담당 아님**), 고객용 백엔드(`server/`)는 Node.js + Express + TypeScript, DB/인증은 Supabase, **LLM은 OpenAI API**(`gpt-4.1-mini`), 푸시는 FCM. 관리자용 웹(`admin-web`, 별도 저장소, **임시/프로토타입 취급**)과 그 백엔드(`server_admin/`, 이 리포 포함)가 클리닉별 로그인 기반 가상 EMR 입력 도구. **가비아 클라우드에 실제 배포됨**(`1.201.116.115`, 2026-08-18~8/28 한시 운영) — 두 프론트팀(Android/admin-web)이 이 서버를 baseUrl로 쓰고 있음.

## 완료된 작업
- **(8) 세션 커밋 — 추천 tie-break 수정 + 시술명 정식화** (`3ec9160`, `d44d823`): 직전 세션 작업 내용. 상세는 progress.md 2026-08-20(8) 참고.
- **git pull로 origin의 11개 커밋 로컬 반영 확인**(`765474e`→`d44d823`): FCM 푸시 알림+`treatment_guides` 도입, `emr_care_records`/`care_records` `care_type` 완전 삭제, seed 스크립트 복구+브랜드 소유권 검증, 전화번호 중복 등록 차단, 예약일 기준 이용권 미차감(마이그레이션 026)+`session_number` 재동기화, 미래 예약 "최근 관리" 제외, FCM 발송 실패 로깅 등. `npm install`로 신규 의존성(`node-cron`, `firebase-admin` 등) 양쪽(`server`/`server_admin`) 설치, typecheck 통과 확인. 사용자에게 커밋별 내용 브리핑 완료
- **다음 관리 추천 — 과거 시술 이력 없이 관심목표만으로도 추천 가능하도록 수정**: 사용자가 "예약만 있고 과거 관리 이력 없는 고객은 관심목표만으로 추천해야 한다" + "환자 등록만 하고 시술 미등록 상태로 앱 가입하면 홈화면이 이상하게 뜬다" 두 가지 보고 → 원인: `computeNextCareRecommendation`이 `getLatestCareRecord`가 null이면(과거 이력 없음) 무조건 조기 `return null`, 관심목표 반영 자체가 안 됐음
  - `server/src/services/recommendations.service.ts`: 조기 종료 제거, `latestCare` optional 처리(`latestCareName: latestCare?.care_name ?? null`), 이력 없어도 `goalOverlap` 기반 점수 계산이 자연히 동작하도록 정리. `server/src/services/llm/recommendation.prompt.ts`: `latestCareName` 타입을 `string | null`로 변경
  - 실 DB 임시 테스트 계정으로 라이브 검증: 관심목표만 있고 이력 없는 계정 → `basis: ["catalog","goal"]` 정상 추천, 관심목표도 이력도 없는 계정 → 여전히 `204`(정당한 케이스), `getNextCareRecommendationDetail`도 정상 동작 확인
  - `interestGoals`가 백엔드에서 실제로는 optional(`z.array().default([])`)임을 확인해 사용자에게 안내 — 앱 UX가 필수 선택으로 강제하고 있어 백엔드 검증 강화는 불필요하다고 사용자가 결정(현행 유지)
- **회원 탈퇴 API(`DELETE /profile`) 신규 구현** — 사용자 요청: "환자 등록은 그대로, 앱 회원가입 기록만 사라지게". 처음엔 가입 후 시술기록도 함께 영구 삭제되는 설계였으나, 사용자에게 리스크 설명 후 "emr_*로 되돌려 보존"으로 결정
  - `server/src/services/profile.service.ts`의 `withdraw()`: 비밀번호 재확인 → 가입 후 새로 생긴 `care_records`/`memberships`를 `emr_care_records`/`emr_memberships`로 되돌리는 `rehydrateEmrData()`(이관분은 `external_record_id`로 원본 emr 행을 찾아 최신 소비 상태로 갱신, 신규분만 새 행 생성 — 중복 방지) → `emr_patients.claimed_user_id`/`claimed_at` null 처리(다중 클리닉 자동연결 형제 행도 한 번에 풀림) → `auth.users` 계정 삭제(CASCADE로 나머지 앱 테이블 정리)
  - `memberships`에 `external_record_id` 컬럼이 없어서(`care_records`엔 001부터 있었음) 마이그레이션 027(`add_membership_external_record_id.sql`) 신규 작성 → 사용자가 Supabase SQL Editor에 적용 완료
  - `server/src/services/auth.service.ts`의 `migrateEmrDataToApp()`이 이관 시 `care_records.external_record_id`/`memberships.external_record_id`에 원본 emr 행 id를 채우도록 수정(기존엔 `care_records` 쪽도 안 채우고 있었음)
  - 실 DB 임시 테스트 계정으로 라이브 검증(가입 전 원본 1건 + 가입 후 이어쓴 기록 1건 + 완전 신규 이용권/시술기록 세트로 실제 탈퇴 실행): 이관분은 중복 없이 원본이 갱신됨(used_count 등), 신규분은 새 emr 행으로 정확히 되돌아옴, 재가입(re-claim) 정상 동작까지 확인
- **문서 동기화 + 아티팩트 재배포** — `docs/api-spec.md`(v0.18→v0.19)/`.html`: `DELETE /profile` 절 신규, 매칭 알고리즘에 이력 없어도 동작하는 조건 추가, 관련 changelog. `docs/db-schema.md`(v0.11→v0.12)/`.html`: `memberships.external_record_id` 컬럼 문서화, 마이그레이션 027 절 신규. `server/README.md`: v0.19 두 항목 changelog 추가. 두 아티팩트(API 명세서 `5cf6ed55...`, DB 스키마 `f152ff3e...`) WebFetch로 현재 게시본 확인 후 재배포 완료

## 현재 작업 중
- 위 전체(추천 수정 + 회원 탈퇴 API + 마이그레이션 027 + 문서 동기화)를 커밋하는 중 — `/기록저장` 실행 직후라 아직 git commit 전. 다음 턴에 커밋+푸시 진행 예정(사용자가 "문서까지 동기화하고 커밋해줘"로 이미 승인함)

## 다음 할 일
- **이번 세션 변경사항 커밋+푸시** (사용자 승인 완료, 바로 진행)
- 커밋 후 가비아 서버 배포 안내 필요(`git pull && npm install && npm run build && pm2 restart`, server/server_admin 둘 다 — 특히 마이그레이션 027은 서버 재시작 전에 Supabase에 적용되어 있어야 함, 이미 적용 완료 확인됨)
- 위험 신호 키워드 목록(`server/src/lib/riskKeywords.ts`) 전문가 검수(이월)
- refreshToken 만료 기간 정책 확정 미완료(이월)
- admin-web의 이용권 자동서치 미구현은 "임시 프로토타입이라 안 고쳐도 됨"으로 사용자가 결정 — 별도 후속 조치 불필요(참고용으로만 기록)
- `docs/image.png`는 사용자가 가비아 서버 터미널 스크린샷을 붙여넣는 스크래치 파일(문서 자산 아님) — 계속 커밋 대상에서 제외
- 미추적 파일(관례상 커밋 제외 중): `docs/AAC_클리닉_자산_조사.docx`, `docs/WHS_After_Mate_Admin_revised.html`

## 주요 파일
- `server/src/services/recommendations.service.ts` — **이번 세션**. `computeNextCareRecommendation`의 `latestCare` 필수 조기 종료 제거, 이력 없이 관심목표만으로도 추천 가능
- `server/src/services/profile.service.ts` — **이번 세션 신규**. `withdraw()`(회원 탈퇴)+`rehydrateEmrData()`(병원 데이터 보존)
- `server/src/routes/profile.routes.ts`, `server/src/validators/profile.validators.ts` — **이번 세션**. `DELETE /profile` 라우트+`withdrawSchema` 추가
- `server/src/services/auth.service.ts` — **이번 세션**. `migrateEmrDataToApp()`이 이관 시 `care_records`/`memberships`의 `external_record_id`를 원본 emr 행 id로 채우도록 수정
- `server/db/migrations/027_add_membership_external_record_id.sql` — **이번 세션 신규**. `memberships.external_record_id` 컬럼 추가(적용 완료)
- `docs/api-spec.md`/`.html` — v0.19(회원 탈퇴 API, 이력 없이 관심목표 기반 추천). `docs/db-schema.md`/`.html` — v0.12(`memberships.external_record_id`, 마이그레이션 027)
- GitHub: https://github.com/WHS-After-Mate/Backend (main, 최신 push는 `d44d823` — 이번 세션 변경은 아직 미푸시)
- 배포 서버: 가비아 클라우드 `1.201.116.115` — `~/Backend`에 git clone, pm2 프로세스명 `whs-server`(4000, server용)/`whs-admin`(4100, server_admin용). 이번 세션 변경은 아직 미배포(커밋+푸시 후 사용자가 서버에서 pull+재시작 필요)

## 특이사항 / 결정 사항
- **회원 탈퇴 시 "가입 후 병원에서 쌓인 데이터"를 보존할지 삭제할지는 사용자에게 직접 물어 결정**(AskUserQuestion) — "emr_*로 되돌려 보존" 선택. 처음 구현 시도에서 가입 전/후 데이터를 구분 못 해 emr_care_records에 중복 생성되는 버그를 라이브 테스트로 직접 잡아냄 → `external_record_id` 기반 이관분/신규분 구분 설계로 재작업
- **`memberships`에 `care_records`와 대칭되는 `external_record_id`가 원래 없었음** — `care_records`는 001_init부터 있었는데 `memberships`엔 대응 컬럼이 빠져있어서 신규 마이그레이션(027) 필요했음. 이 컬럼 도입 이전에 이미 이관된 기존 행은 출처를 알 수 없어 null로 남고, 탈퇴 시 "가입 후 신규"로 간주해 새 emr 행 생성(데이터 유실보다 안전한 방향으로 설계)
- **interestGoals는 백엔드에서 optional** — 앱 UX가 회원가입 시 필수 선택으로 강제하지만 서버 validator(`z.array().default([])`)는 빈 배열도 허용. 사용자가 "UX가 강제하니 백엔드는 그대로 둬도 된다"고 확정 — 추가 검증 불필요
- **이 환경에서 가비아 서버(`1.201.116.115`)로 직접 curl/네트워크 접근이 안 됨** — 아웃바운드 연결 자체가 타임아웃남(SSH 불가와는 별개 제약). 배포 검증은 사용자가 서버 터미널에서 `pm2 list`/`pm2 logs` 등을 직접 실행해 결과를 알려주거나 `docs/image.png`에 스크린샷을 붙여주는 방식으로만 가능
- **`recommendations.service.ts`의 동률 처리 설계 원칙**(8세션 결정, 계속 유효): `goalOverlap`이 1차 기준이지만 대부분의 시술이 태그 1~2개뿐이라 사실상 거의 항상 동률 — "관심목표와 겹치는 태그의 최근 이력"으로 좁혀야 관심목표 변경이 실제로 체감되는 추천 변화를 만든다
- **커밋 전 항상 사용자에게 확인** — 세션 규칙으로 고정, 이번 세션도 문서 동기화+커밋 승인 명시적으로 받음
- **가비아 서버 root 비밀번호는 어디에도 기록돼 있지 않음**(의도적으로 저장 안 함) — 필요시 가비아 콘솔에서 직접 확인해야 함
- 세션 재시작 시 이 파일이 자동으로 브리핑됨(글로벌 CLAUDE.md 설정)
