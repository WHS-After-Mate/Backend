# WHS After Mate — Backend

AAC 웰니스 클리닉 고객을 위한 사후관리 앱의 백엔드 설계 저장소. 관리 이력·이용권 조회, LLM 기반 일차별 사후관리 안내·질문, 다음 관리 추천을 제공하는 3주 해커톤 MVP입니다.

이 서비스는 클리닉(AAC)의 의료 데이터베이스(EMR)에 있는 환자 기록(시술 이력, 알러지, 의사 코멘트)을 바탕으로, 환자 본인에게 맞춤 사후관리를 제공합니다 — 환자가 자신의 진료기록을 열람하는 patient-portal과 유사한 구조입니다.

기획 원본: Manyfast 프로젝트 `WHS After Mate` (project id `130a998c-b6dc-4869-b94d-792f91e79500`)

## 기술 스택

| 영역 | 선택 | 비고 |
|---|---|---|
| 클라이언트 | Android (Android Studio) | 네이티브 Android 앱, REST/JSON으로 서버와 통신 |
| 서버 | Node.js + Express + TypeScript | `server/` — api-spec.md 절 구성과 1:1 대응하는 라우터 구조 |
| DB | PostgreSQL (Supabase) | FK/UNIQUE/CHECK 제약과 관계형 조인이 필요한 스키마 구조 |
| 인증 | Supabase Auth | 이메일/비밀번호 계정·토큰 발급을 위임, 전화번호 SMS 인증만 자체 구현 |
| LLM | Anthropic Claude API | 일차별 사후관리 가이드 생성 + 챗봇 Q&A 답변, 2곳에서만 호출. 구조화 출력(tool use)으로 JSON 스키마 강제 |
| 푸시 알림 | Firebase Cloud Messaging (FCM) | Android 클라이언트 특성상 FCM 전제로 설계, 디바이스 토큰 등록 API 포함 |

서버 실행 방법은 [`server/README.md`](server/README.md) 참고.

## 문서 구조

| 문서 | 버전 | 내용 |
|---|---|---|
| [`docs/api-spec.md`](docs/api-spec.md) / `.html` | v0.5 | 전체 API 엔드포인트 명세 (요청/응답, 에러 코드, 데이터 모델). v0.5는 최종 와이어프레임 검토로 추가된 9개 항목 포함 — 구현·마이그레이션·시드 전부 완료 (문서 내 "v0.5에서 추가된 항목" 절 참고) |
| [`docs/api-user-flow.html`](docs/api-user-flow.html) | — | 화면 유저플로우에 실제 API 호출을 매핑한 순서도 (mermaid, 확대/드래그 가능). 비밀번호 재설정/변경 흐름(v0.5) 포함 |
| [`docs/db-schema.md`](docs/db-schema.md) / `.html` | v0.3 | ERD + 테이블별 `CREATE TABLE` DDL, 설계 결정과 트레이드오프. v0.3 추가분(컬럼 6개, 신규 테이블 1개)은 마이그레이션(`server/db/migrations/003_v05_wireframe_features.sql`) 적용 완료 |
| [`docs/llm-prompt-design.md`](docs/llm-prompt-design.md) / `.html` | v0.1 | LLM 호출 파이프라인, 컨텍스트 주입 필드, 시스템 프롬프트 초안, 출력 스키마 |
| [`docs/server-code-guide.md`](docs/server-code-guide.md) / `.html` | v0.1 | 위 문서들과 달리 API 계약이 아니라 **`server/src` 코드 자체의 동작**을 설명 (레이어 구조, 요청 파이프라인, LLM 파이프라인 단계별 흐름, 파일별 역할) |
| [`docs/frontend-integration-guide.md`](docs/frontend-integration-guide.md) / `.html` | v0.1 | Android(프론트) 담당자용 — 리포 clone, `.env` 설정, 서버 실행, baseUrl(에뮬레이터/실기기), 데모 계정, Retrofit 호출 예시, 자주 막히는 지점 |

`.html` 파일은 브라우저로 직접 열면 표·다이어그램이 렌더링된 문서로 보입니다 (외부 의존성 없이 단일 파일로 동작). `.md` 파일은 실제 구현 시 복붙할 SQL/JSON을 포함한 원본입니다.

## 아키텍처 한눈에 보기

- **인증**: 회원가입은 전화번호 SMS 인증 → 이메일/비밀번호 가입 순서, 로그인은 이메일/비밀번호만 (Supabase Auth)
- **의료 데이터**: `care_records`(시술 이력), `medical_profiles`(알러지·기저질환·의사 코멘트)는 클리닉 EMR에서 동기화된 사본으로 취급. 민감정보라 `medical_data_access_log`로 접근 이력을 남김
- **LLM 호출은 2곳뿐**: `GET /aftercare/daily-guide`(하루 1회 캐시), `POST /aftercare/questions`(매 요청). 위험 신호·미지원 카테고리는 LLM 호출 전에 규칙 기반으로 차단
- **테이블을 일부러 안 만든 것들**: 다음 관리 추천(실시간 규칙 계산), refresh token(Supabase 내부 관리), 캘린더(집계 쿼리로 대체) — 자세한 이유는 `db-schema.md`의 "설계 결정" 참고

## 진행 상황

현재까지의 작업 이력과 다음 할 일은 [`.work-log/current.md`](.work-log/current.md)에 정리되어 있습니다.

### 구현 현황 (2026-08-02 기준)

문서 설계 단계를 넘어 **백엔드 실제 구현 + Supabase 연동 + 엔드투엔드 테스트까지 완료**했습니다.

- `server/` 디렉토리에 api-spec.md 전 엔드포인트 구현 (인증, 홈/추천, 사후관리 Q&A+LLM, My Care, 프로필/알림)
- Supabase 프로젝트 실제 생성 → 마이그레이션 적용 → 10개 테이블 생성 확인
- Anthropic Claude API 연동 확인: `daily-guide`가 알러지·의사 코멘트를 반영해 실제 생성되고, `questions`는 정상 답변/근거 부족 시 `out_of_scope`/위험 신호 시 `expert_required` 3가지 케이스 모두 정상 동작 검증
- 테스트 중 발견한 버그(Claude 응답에 `</answer>` 등 XML 태그 흔적 섞임)를 `sanitizeLlmText.ts`로 수정
- 서버 실행 방법은 [`server/README.md`](server/README.md) 참고 — Android Studio 에뮬레이터에서는 `http://10.0.2.2:4000/api/v1`로 접근

### v0.5 추가 구현 (2026-08-05 기준)

최종 프론트 와이어프레임(`WHS After Mate.png`) 검토로 `api-spec.md` v0.4 → v0.5에 추가된 9개 항목(비밀번호 재설정/변경, 프로필 생년월일/휴대폰, 마케팅 알림, 이용권 회차별 사용이력, 관리 상세 확장, 일차별 가이드 탭 조회, 추천 상세 확장)을 **서버 코드 구현, DB 마이그레이션 적용, 데모 데이터 재시드까지 전부 완료**했습니다.

- DB 변경이 필요한 항목은 `server/db/migrations/003_v05_wireframe_features.sql`을 **Supabase 프로젝트에 실제 적용 완료**했습니다(001 → 002 → 003 순서).
- 비밀번호 재설정/변경은 DB 변경 없이 Supabase Auth만으로 동작합니다.
- 데모 시드 데이터(`server/db/seed/seed.ts`)도 생년월일·이용권 회차별 사용이력·관리 상세 연결 정보(홍길동·김민지·이서준 3개 계정)를 포함하도록 갱신해 `npm run seed`로 재시드했고, Supabase에서 직접 조회해 값이 채워진 것까지 확인했습니다.

다음 단계는 Android Studio 프로젝트에서 이 서버 API를 실제로 연동하는 작업입니다.

## 미확정 사항

- 위험 신호 키워드 목록 — `server/src/lib/riskKeywords.ts`에 초안 작성했으나 전문가(의료진) 검수 필요
- refreshToken 만료 정책 (Supabase Auth 기본값 사용 중, 서비스 정책 확정 필요), 알림 설정 세부 항목 범위
- FCM 실제 발송 스케줄러(아침 리마인더 등) — 배선만 준비, 트리거 로직은 MVP 범위 밖
