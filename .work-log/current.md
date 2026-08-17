# After School 현재 상태
최종 업데이트: 2026-08-17 14:30

## 프로젝트 개요
WHS After Mate — AAC 웰니스 고객용 관리 이력·이용권 조회, LLM 기반 일차별 사후관리 안내·질문, 다음 관리 추천 MVP(3주 해커톤). 앱 클라이언트는 Android Studio(네이티브 Android, **프론트엔드는 사용자 담당 아님 — 이 세션에서 다루지 않음**), 고객용 백엔드(`server/`)는 Node.js + Express + TypeScript, DB/인증은 Supabase, LLM은 Anthropic Claude API, 푸시는 FCM. 관리자용 웹(`admin-web`, **별도 GitHub 저장소 — 이 백엔드 리포에서는 건드리지 않음**)과 그 백엔드(`server_admin/`, 이 리포에 포함)가 클리닉별 로그인 기반 가상 EMR 입력 도구로 자리잡았다.

## 완료된 작업
- **예약 취소 기능 구현** — 이전 세션에 보류됐던 항목("나중에 앱과 연동해 금일/향후 예약을 취소하는 기능으로 별도 구현 예정"). 사용자에게 AskUserQuestion으로 두 가지 확인: 구현 위치(고객 앱 vs 관리자 웹) → **관리자 웹(`server_admin`)**, 취소 시 데이터 처리(소프트 취소 vs 완전 삭제) → **완전 삭제(기존 `DELETE /care-records/:careRecordId`와 동일 방식)**
  - 조사 결과 "예약"(=미래 `careDate`를 가진 시술기록) 자체를 삭제하는 메커니즘(이용권 환불 포함)은 이미 존재했음 — 실제로 빠져있던 건 "어느 careRecordId를 지울지 찾는 수단"이었다(`GET /visit-stats`는 날짜별 **건수**만 반환, 개별 항목 없음)
  - **`GET /reservations?date=`** 신규 구현(`server_admin/src/{routes,services,validators}/patients.*.ts`) — 특정 날짜(미지정 시 오늘 KST)에 `careDate`가 잡힌 로그인 클리닉의 시술기록을 `careRecordId`+환자명+전화번호+`source`(emr/app)와 함께 목록 반환. `emr_care_records`+`emr_patients` 조인(FK 임베드 가능) / `care_records`는 `profiles`와 직접 FK가 없어 `user_id`로 별도 조회 후 애플리케이션 레벨 병합, `getVisitStats`와 동일한 `kstDateString` 패턴 재사용
  - 취소 자체는 별도 엔드포인트 없이 위 목록에서 얻은 `careRecordId`로 **기존 `DELETE /care-records/:careRecordId`를 그대로 호출**(이용권 환불 로직 그대로 적용) — 날짜 제한 없음, 오늘/내일뿐 아니라 어떤 날짜의 예약이든(과거 포함) 같은 방식으로 조회·취소 가능
  - typecheck/build 통과, 실서버(4100)로 환자 등록 → 내일 날짜 시술기록(예약) 생성 → `GET /reservations?date=`로 조회(careRecordId 확인) → `DELETE`로 취소 → 목록에서 사라짐까지 종단 검증, 테스트 데이터 정리 완료
  - `docs/admin-api-spec.md`/`.html`(v0.3→v0.4) 신규 엔드포인트 절 추가, `server_admin/README.md` 엔드포인트 표 갱신 + "예약 취소 기능 미구현" 항목 제거, `server_admin/src/examples/admin-api-example.html`에 "G. 예약 목록/취소" 섹션 추가(목록 테이블 + 행별 취소 버튼, 취소 후 자동 재조회) — 브라우저 확장 미연결로 실제 클릭 테스트는 못 했고 문법 검사(`node --check`)+API 응답 형태 대조로만 확인
  - HTML 태그(`<table>`/`</table>`, `<section>`/`</section>`, `.endpoint-card`) 개수 대조로 admin-api-spec.html 균형 확인

## 현재 작업 중
- (없음 — 이번 세션 작업 커밋+푸시 대기 중, 사용자 요청으로 곧 진행)

## 다음 할 일
- **클라이언트(앱) 회원가입 화면에 전화번호 입력란 추가 필요** — 서버는 `phone`을 required로 받으므로, 프론트가 이 필드 없이 호출하면 400. 프론트엔드는 사용자 담당이 아니라 이 리포/세션에서 구현하지 않음(별도 담당자에게 전달 필요)
- (README에 기록됨) 치료-부위 카탈로그가 시술기록 저장(`careName`/`careType`/`partOfBody`)을 강제하지 않음 — 프론트에서 카탈로그로 자동완성만 붙이고 서버는 검증 안 함. 필요해지면 서버 레벨 검증 추가 검토
- (README에 기록됨) 이용권 자동 이어쓰기 매칭 정확도 — `product_name`+`total_count` 완전 일치만 인식. 관리자가 카탈로그에서 치료명을 선택 입력하게 하는 프론트 구현으로 표기 불일치를 줄일 수 있음(아직 미구현)
- 가비아 클라우드 배포 — 크레딧 지급 조건 확인 후 진행 예정(아직 착수 전)
- (이월) 프론트 담당자 GitHub Collaborator 초대 미발송
- (이월) `.env` 비밀값을 프론트 담당자에게 git 아닌 채널로 전달
- (이월) 위험 신호 키워드 목록(`server/src/lib/riskKeywords.ts`) 전문가(의료진) 검수
- (이월) FCM 실제 발송 스케줄러 트리거 로직 미구현
- (이월) refreshToken 만료 정책 확정 미완료
- (이월) `docs/AAC_클리닉_자산_조사.docx` git 커밋 여부 여전히 미결정(untracked)
- Gmail SMTP는 트랜잭션 메일 전용 서비스가 아니라 발송량이 몰리면 스팸/전송 제한 리스크가 있음 — 정식 서비스 규모로 갈 때 도메인 기반 트랜잭션 메일 서비스(Resend 등)로 재검토 필요(도메인 확보되면)
- admin-api-example.html "G. 예약 목록/취소" 섹션은 브라우저에서 실제 클릭 검증이 아직 안 됨(확장 미연결) — 다음 세션에 여유 있으면 실브라우저로 한 번 확인

## 주요 파일
- `server_admin/src/services/patients.service.ts` — 환자/시술기록/이용권/방문통계/예약 전체 로직. claim 여부 분기(emr_* vs 실제 테이블), 중복 환자 재사용+notes 갱신, `getVisitStats`(전날/금일/익일 예약 건수), **`listReservations`(신규, 이번 세션 — 날짜별 예약 개별 목록)**, 이용권 만료(`addOneYear`)/자동 이어쓰기(`findContinuableMembership`)
- `server_admin/src/routes/patients.routes.ts` — `GET /reservations` 신규 라우트(이번 세션)
- `server_admin/src/validators/patients.validators.ts` — `listReservationsQuerySchema`(신규, 이번 세션)
- `server_admin/src/examples/admin-api-example.html` — admin-web 대체 수동 테스트 페이지. 이번 세션에 "G. 예약 목록/취소" 섹션 추가
- `server/src/services/auth.service.ts` — `signup()`(phone 신원확인 조건 포함), `requestPasswordReset`/`confirmPasswordReset`(숫자 코드 방식, Gmail SMTP로 발송)
- `docs/admin-api-spec.md`/`.html` — server_admin 전체 API 명세(v0.4, 이번 세션에 `GET /reservations` 반영), 아티팩트로도 발행됨(단, 이번 세션엔 재발행 안 함 — 필요 시 다음에)
- `docs/api-spec.md`/`.html` — 고객용 server/ API 명세, 회원가입 phone 신원확인(v0.7) 반영(이번 세션엔 변경 없음)
- `server_admin/README.md`, `server/README.md` — 각각 엔드포인트 요약 및 구현 노트, 이번 세션에 server_admin README 갱신
- Supabase 프로젝트: "youyongsang's Project MS"(ref `qcaivwfjgubievzijkwi`) — SMTP 발신 계정은 `ykenko02@gmail.com`(발송 전용)
- `docs/db-schema.md`/`.html`, `docs/server-code-guide.md`/`.html` — 007~013 마이그레이션 반영해 동기화된 상태(이번 세션엔 변경 없음)
- GitHub: https://github.com/WHS-After-Mate/Backend (main, 최신 push는 `13d2d76` — 이번 세션 커밋은 사용자 요청으로 진행 예정)

## 특이사항 / 결정 사항
- **예약 취소를 관리자 웹에서, 완전 삭제 방식으로 구현하기로 한 배경**: 소프트 취소(status='cancelled')도 후보였으나, 기존 `DELETE /care-records/:careRecordId`가 이미 이용권 환불까지 처리하는 검증된 로직이라 그대로 재사용하는 쪽을 택함 — 소프트 취소로 갔다면 `status` 컬럼에 새 값 도입 + 이력 화면(캘린더/목록/통계)에서 취소된 건을 어떻게 표시할지까지 추가 설계가 필요했을 것
- **"예약"은 여전히 별도 테이블이 아니라 미래 `careDate`를 가진 시술기록 그 자체** — `GET /reservations`도 이 원칙을 그대로 따라 `care_records`/`emr_care_records`를 날짜로 필터링만 할 뿐, 새 테이블/컬럼을 추가하지 않았다
- **회원가입 신원확인에 전화번호를 추가하기로 한 배경**: 원래 v0.6 설계는 "전화번호는 EMR 원본을 그대로 신뢰하고 클라이언트에 재입력을 안 받는다"였음(동명이인/오탈자 리스크보다 UX 단순화를 우선). 사용자가 관리자 쪽(이름+생년월일+전화번호 중복판정)과의 비대칭을 지적하고, 신원확인 강도를 우선하기로 결정하며 뒤집힘 — **다음에 이 판단을 다시 마주치면 "UX 단순화 vs 신원확인 강도" 트레이드오프에서 후자를 택한 전례로 참고할 것**
- **프론트엔드는 사용자 담당이 아님** — 이 리포엔 애초에 고객용 앱 프론트엔드 코드가 없음(admin-web도 별도 저장소). API/서버/문서까지가 이 세션의 스코프
- **비밀번호 재설정 이메일 발송은 Resend가 아니라 발송 전용 Gmail 계정 SMTP를 사용** — 도메인 구매 없이 실사용자 전체에게 발송 가능하게 하기 위한 선택. 개인 메인 Gmail 계정이 아니라 이 용도로만 새로 만든 계정(`ykenko02@gmail.com`)을 써서 리스크 격리
- **비밀번호 재설정 인증코드는 표준 "6자리"가 아님** — 이 프로젝트는 실측 8자리. 문서/검증 로직에 자릿수를 하드코딩하지 말 것(6~10자리로 느슨하게 검증)
- **Windows tsx watch 재시작 이슈** — 여전히 유효, `npm run build` 후 `node dist/src/server.js` 권장
- **claude-in-chrome 브라우저 확장이 이 환경에 연결 안 됨** — UI 변경 실브라우저 검증이 필요할 때 다음 세션에서 다시 시도해볼 것(문법 검사+API 레벨 검증으로 대체한 이력 있음)
- 세션 재시작 시 이 파일이 자동으로 브리핑됨(글로벌 CLAUDE.md 설정)
