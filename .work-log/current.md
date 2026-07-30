# After School 현재 상태
최종 업데이트: 2026-07-30 21:30

## 프로젝트 개요
WHS After Mate — AAC 웰니스 고객용 관리 이력·이용권 조회, LLM 기반 일차별 사후관리 안내·질문, 다음 관리 추천 MVP(3주 해커톤). Manyfast 프로젝트(130a998c-b6dc-4869-b94d-792f91e79500) 기획 문서를 바탕으로 백엔드 담당자(사용자)가 API 명세서·DB 스키마·LLM 프롬프트 설계를 문서화 중.

## 완료된 작업
- Manyfast 프로젝트의 PRD/요구사항/기능/유저플로우(v2 "사후관리 Q&A AI 일차별 업데이트", 39개 노드) 확인
- API 명세서(`docs/api-spec.md`, `docs/api-spec.html`) v0.4까지 작성
  - 인증: 실제 계정 로그인 + 전화번호 SMS 인증 회원가입(`/auth/signup/verify-phone/*`, `/auth/signup`, `/auth/login`, `/auth/refresh`, `/auth/logout`)
  - 홈: `/home/summary` + 추천(`/recommendations/next-care`, `/next-care/{id}`)
  - 사후관리 Q&A(LLM 기반): `/aftercare/daily-guide`, `/aftercare/question-categories`, `/aftercare/questions`
  - My Care: 캘린더(`/care-records/calendar`)/이력(`/care-records`)/이용권(`/memberships`) — 캘린더·이력 모두 같은 관리 상세로 수렴, 상세에서 AI 가이드로 연결
  - 설정/프로필: `/profile`, `/profile/interests`, `/notifications/settings`
  - 섹션 순서를 API 유저플로우 다이어그램과 완전히 일치시킴 (인증→홈→사후관리Q&A→MyCare→설정)
- API 유저플로우 다이어그램(`docs/api-user-flow.html`) — mermaid flowchart, 확대/드래그 뷰어 포함. 사후관리 카드/AI에게 물어보기 버튼 2개 진입 경로, My Care 캘린더/이력/이용권 3개 진입점, 회원가입 경로까지 반영
- DB 스키마(`docs/db-schema.md`, `docs/db-schema.html`) v0.2 — PostgreSQL(Supabase) 채택, ERD + 테이블별 CREATE TABLE DDL
  - 인증은 Supabase Auth에 위임, 전화인증만 자체 구현(`phone_verifications`)
  - 클리닉 EMR 동기화 전제: `care_records`(doctor_comment 추가), `medical_profiles`(알러지·기저질환·의사 종합코멘트), `medical_data_access_log`(민감정보 접근 감사 로그) 신설
  - 추천/refresh token/알림설정/캘린더는 의도적으로 테이블 미생성(계산식·집계·컬럼으로 대체)
  - `aftercare_guides`에 UNIQUE(care_record_id, generated_date)로 "하루 1회 LLM 생성" DB 레벨 강제
  - mermaid ERD 렌더링 버그(`PK_FK`는 잘못된 문법 → `PK`로 수정) 발견 및 수정
- 다른 DB(Firebase/MySQL·PlanetScale/MongoDB) 비교 논의 후 Postgres/Supabase 재확인
- LLM 프롬프트 설계 문서(`docs/llm-prompt-design.md`, `docs/llm-prompt-design.html`) v0.1 신규 작성
  - 공통 원칙 5가지, 파이프라인(규칙필터→컨텍스트조립→LLM호출→출력검증→저장/응답) 다이어그램
  - daily-guide/questions 두 호출 지점별 컨텍스트 주입 필드, 시스템 프롬프트 초안, 출력 JSON 스키마, 실패 폴백 정책
  - `expert_required`는 규칙 단계에서 결정되어 LLM에 도달 안 함을 명확히 구분

## 현재 작업 중
- (특별히 진행 중인 미완료 작업 없음 — 직전 요청은 /기록저장 실행)

## 다음 할 일
- 필요 시 실제 백엔드 구현(Supabase 프로젝트 생성, 테이블 마이그레이션 적용)
- 검수된 관리 가이드(RAG 소스) 문서 형식·저장 위치 설계 (아직 스키마/문서에 없음)
- 위험 신호 키워드 목록 구체화 (전문가 검수 필요)
- 미확정 사항 해소: LLM 모델 선택, refreshToken 만료 정책, 알림 설정 항목 충분성, 출력검증 실패 시 재시도 정책

## 주요 파일
- `docs/api-spec.md` / `docs/api-spec.html` — API 명세서 (v0.4)
- `docs/api-user-flow.html` — 화면별 API 호출 순서도 (mermaid, 확대/드래그 지원)
- `docs/db-schema.md` / `docs/db-schema.html` — DB 스키마 (v0.2, Postgres/Supabase, ERD 포함)
- `docs/llm-prompt-design.md` / `docs/llm-prompt-design.html` — LLM 프롬프트 설계 (v0.1)

## 특이사항 / 결정 사항
- DB는 PostgreSQL(Supabase) 확정 — 이유: FK/UNIQUE/CHECK 제약과 관계형 조인이 필요한 스키마 구조 + Supabase Auth로 인증 구현 시간 절약. Firebase/MongoDB는 제약·조인 이슈로 보류, PlanetScale은 FK 미지원이라 제외
- 회원가입은 전화번호 SMS 인증 → 이메일/비밀번호 가입 순서, 로그인은 이메일/비밀번호만
- 이 서비스는 클리닉(AAC) EMR의 환자 기록을 patient-portal처럼 보여주는 구조 — 알러지·의사코멘트는 EMR에서 동기화된 데이터로 취급, 민감정보라 별도 테이블+감사로그로 분리
- LLM은 `/aftercare/daily-guide`(하루 1회 캐시)와 `/aftercare/questions`(매 요청) 두 곳에서만 호출되고, 위험 신호·미지원 카테고리는 LLM 호출 전에 규칙 기반으로 차단
- 세션 재시작 시 이 파일이 자동으로 브리핑됨 (글로벌 CLAUDE.md 설정)
