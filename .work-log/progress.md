## 2026-08-02 (2)
- `server/src/routes/*.routes.ts` 8개 파일 전체에 요구사항 매핑 주석 추가 — 각 엔드포인트가 `api-spec.md`의 몇 절·어떤 요구사항 ID(R-USXPEM/R-QGENNK/R-DCDOJF/F-GBZTGO/F-ULCIXA)를 구현하는지와 캐싱·폴백·사전 차단 등 동작을 명시, 타입체크 통과 확인
- 신규 문서 `docs/server-code-guide.md`(+ `.html`) 작성 — api-spec 등 기존 문서가 API 계약을 설명한다면 이 문서는 `server/src` 코드 자체의 동작(레이어 구조/요청 파이프라인/인증 흐름/LLM 파이프라인 단계별 흐름/파일별 역할/문서-코드 차이 표)을 설명. html은 기존 docs 3종과 동일한 디자인 시스템으로 제작
- 루트 `README.md` 문서 인덱스에 신규 문서 항목 추가
- (이번 세션 변경사항은 아직 git commit/push 전 — 다음 세션에서 처리 필요)

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
