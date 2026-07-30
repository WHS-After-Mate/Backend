# WHS After Mate — Backend

AAC 웰니스 클리닉 고객을 위한 사후관리 앱의 백엔드 설계 저장소. 관리 이력·이용권 조회, LLM 기반 일차별 사후관리 안내·질문, 다음 관리 추천을 제공하는 3주 해커톤 MVP입니다.

이 서비스는 클리닉(AAC)의 의료 데이터베이스(EMR)에 있는 환자 기록(시술 이력, 알러지, 의사 코멘트)을 바탕으로, 환자 본인에게 맞춤 사후관리를 제공합니다 — 환자가 자신의 진료기록을 열람하는 patient-portal과 유사한 구조입니다.

기획 원본: Manyfast 프로젝트 `WHS After Mate` (project id `130a998c-b6dc-4869-b94d-792f91e79500`)

## 기술 스택

| 영역 | 선택 | 비고 |
|---|---|---|
| DB | PostgreSQL (Supabase) | FK/UNIQUE/CHECK 제약과 관계형 조인이 필요한 스키마 구조 |
| 인증 | Supabase Auth | 이메일/비밀번호 계정·토큰 발급을 위임, 전화번호 SMS 인증만 자체 구현 |
| LLM | 모델 미확정 | 일차별 사후관리 가이드 생성 + 챗봇 Q&A 답변, 2곳에서만 호출 |

## 문서 구조

| 문서 | 버전 | 내용 |
|---|---|---|
| [`docs/api-spec.md`](docs/api-spec.md) / `.html` | v0.4 | 전체 API 엔드포인트 명세 (요청/응답, 에러 코드, 데이터 모델) |
| [`docs/api-user-flow.html`](docs/api-user-flow.html) | — | 화면 유저플로우에 실제 API 호출을 매핑한 순서도 (mermaid, 확대/드래그 가능) |
| [`docs/db-schema.md`](docs/db-schema.md) / `.html` | v0.2 | ERD + 테이블별 `CREATE TABLE` DDL, 설계 결정과 트레이드오프 |
| [`docs/llm-prompt-design.md`](docs/llm-prompt-design.md) / `.html` | v0.1 | LLM 호출 파이프라인, 컨텍스트 주입 필드, 시스템 프롬프트 초안, 출력 스키마 |

`.html` 파일은 브라우저로 직접 열면 표·다이어그램이 렌더링된 문서로 보입니다 (외부 의존성 없이 단일 파일로 동작). `.md` 파일은 실제 구현 시 복붙할 SQL/JSON을 포함한 원본입니다.

## 아키텍처 한눈에 보기

- **인증**: 회원가입은 전화번호 SMS 인증 → 이메일/비밀번호 가입 순서, 로그인은 이메일/비밀번호만 (Supabase Auth)
- **의료 데이터**: `care_records`(시술 이력), `medical_profiles`(알러지·기저질환·의사 코멘트)는 클리닉 EMR에서 동기화된 사본으로 취급. 민감정보라 `medical_data_access_log`로 접근 이력을 남김
- **LLM 호출은 2곳뿐**: `GET /aftercare/daily-guide`(하루 1회 캐시), `POST /aftercare/questions`(매 요청). 위험 신호·미지원 카테고리는 LLM 호출 전에 규칙 기반으로 차단
- **테이블을 일부러 안 만든 것들**: 다음 관리 추천(실시간 규칙 계산), refresh token(Supabase 내부 관리), 캘린더(집계 쿼리로 대체) — 자세한 이유는 `db-schema.md`의 "설계 결정" 참고

## 진행 상황

현재까지의 작업 이력과 다음 할 일은 [`.work-log/current.md`](.work-log/current.md)에 정리되어 있습니다.

## 미확정 사항

- 실제 사용할 LLM 모델
- 검수된 관리 가이드(RAG 소스) 문서 저장 형식/위치
- 위험 신호 키워드 목록 (전문가 검수 필요)
- refreshToken 만료 정책, 알림 설정 세부 항목 범위
