# WHS After Mate — LLM 프롬프트 설계 (v0.1)

기준: `api-spec.md` v0.4, `db-schema.md` v0.2. LLM은 정확히 **2곳**에서만 호출된다: `GET /aftercare/daily-guide`(일차별 가이드, 하루 1회 캐시), `POST /aftercare/questions`(챗봇 Q&A, 매 요청). 그 외 모든 검증(카테고리, 위험 신호)은 **LLM 호출 전에 규칙 기반으로** 처리한다.

---

## 공통 원칙

1. **근거는 오직 두 가지**: (a) 검수된 관리 가이드(관리 유형 2~3개 × 경과일 구간별로 사전 작성된 레퍼런스 문서, RAG 소스), (b) 환자 컨텍스트(관리 이력, 경과일, `medical_profiles`의 알러지·기저질환·의사 코멘트). 이 두 가지 밖의 지식으로 답하지 않는다.
2. **의료적 진단·처방 금지**: 질환명 진단, 회복 완료 판정, 약물 처방, 응급 상태 단독 판단을 생성하지 않는다.
3. **위험 신호·범위 밖 카테고리는 LLM에 도달하기 전에 걸러진다**: 비용·안전 모두를 위해 규칙 엔진이 먼저 처리하고, LLM은 "안전하다고 확인된 요청"만 받는다.
4. **구조화된 출력 강제**: 두 엔드포인트 모두 고정된 JSON 스키마로만 응답받는다(모델의 JSON 모드/함수 호출 사용). 자유 텍스트 응답을 파싱하지 않는다.
5. **알러지·의사 코멘트는 항상 컨텍스트에 포함**: "환자가 알러지 있는 성분을 권하는" 실수를 막기 위해 두 프롬프트 모두 이 필드를 필수로 주입한다. `medical_data_access_log`에 `accessed_by: 'llm_system'`으로 접근 기록을 남긴다.

---

## 파이프라인 (두 엔드포인트 공통 순서)

```
① 규칙 기반 사전 필터
   - daily-guide: care_type/elapsed_range가 지원 범위인가? (404 GUIDE_NOT_AVAILABLE)
   - questions:   category가 지원 6종인가? (422 UNSUPPORTED_CATEGORY)
                  질문에 위험 신호 키워드가 있는가? (status: expert_required, LLM 미호출)
② 컨텍스트 조립
   - care_records (+ doctor_comment), medical_profiles (allergies, chronic_conditions, doctor_general_comment)
   - 검수된 관리 가이드 원문 (해당 care_type × elapsed_range)
③ LLM 호출 (시스템 프롬프트 + 컨텍스트 + 구조화 출력 스키마)
④ 출력 검증
   - 금지어(진단/처방 관련 문구) 필터링
   - 스키마 검증 실패 시 1회 재시도, 계속 실패하면 503
⑤ 저장 / 응답
   - daily-guide → aftercare_guides에 upsert(unique 제약으로 중복 방지)
   - questions   → questions 테이블에 insert
```

---

## 1. `GET /aftercare/daily-guide` — 일차별 사후관리 가이드 생성

### 호출 시점
- 캐시 미스일 때만 (해당 `care_record_id` + 오늘 날짜 조합의 행이 `aftercare_guides`에 없을 때)
- `elapsed_range`(예: "3-7")는 LLM이 정하는 게 아니라 **규칙(구간 lookup)으로 먼저 결정** — LLM은 그 구간에 대해 사전 작성된 가이드를 사용자 상황에 맞게 자연어로 풀어 쓰는 역할만 한다

### 컨텍스트 주입 필드

| 필드 | 출처 | 용도 |
|---|---|---|
| `care_name`, `care_date`, `days_elapsed` | `care_records` | "언제 무슨 시술을 받았는지" |
| `part_of_body`, `brand` | `care_records` | 시술 부위 맥락 |
| `doctor_comment` | `care_records.doctor_comment` | 해당 시술 건에 대한 의사 코멘트 |
| `allergies`, `chronic_conditions` | `medical_profiles` | 특정 성분/행동 회피 근거 |
| `doctor_general_comment` | `medical_profiles` | 환자 전반에 대한 의사 코멘트 |
| 검수된 가이드 원문 | 내부 레퍼런스 문서(관리 유형 × 경과 구간) | 답변의 유일한 사실 근거 |

### 시스템 프롬프트 (초안)

```
당신은 AAC 웰니스 클리닉의 사후관리 안내 도우미입니다.
아래 "검수된 가이드"와 "환자 정보"만을 근거로, 해당 환자의 경과일에 맞는
사후관리 주의사항을 안내하세요.

규칙:
- 검수된 가이드에 없는 내용을 지어내지 마세요.
- 질환을 진단하거나, 회복 완료를 판정하거나, 약물을 처방하지 마세요.
- 환자의 알러지/기저질환에 해당하는 성분·행동이 검수된 가이드에 포함되어
  있다면, 반드시 회피 항목으로 강조하세요.
- 반드시 아래 JSON 스키마로만 응답하세요. 다른 텍스트를 추가하지 마세요.
```

### 출력 스키마 (구조화 출력)

```json
{
  "mustAvoid": ["string"],
  "basicCare": ["string"],
  "nextCheckDate": "YYYY-MM-DD | null"
}
```
→ 이 값들이 `aftercare_guides.must_avoid`, `basic_care`, `next_check_date`에 그대로 저장되고, `generated_by='llm'`, `generated_at=now()`가 함께 기록된다.

### 실패 처리
`503 GUIDE_GENERATION_FAILED` — 사전 작성된 관리 유형별 기본 안내 문구(검수된 가이드 원문 그대로)로 폴백. LLM 없이도 최소 안전한 답을 보장한다.

---

## 2. `POST /aftercare/questions` — 챗봇 Q&A 답변 생성

### 호출 시점
매 질문마다 (캐싱 없음 — 질문이 매번 다르므로)

### 사전 규칙 필터 (LLM 호출 전)

| 조건 | 처리 |
|---|---|
| `category`가 지원 6종(세안·샤워/화장·렌즈/운동·사우나/음주·흡연/화장품·성분/증상) 밖 | `422 UNSUPPORTED_CATEGORY`, LLM 미호출 |
| 질문에 위험 신호 키워드 포함 (예: 통증 증가, 출혈, 시야 이상, 고열, 호흡곤란) | `status: expert_required`, LLM 미호출, 전문가 문의 문구 즉시 반환 |

### 컨텍스트 주입 필드
daily-guide와 동일 (`care_name`, `days_elapsed`, `doctor_comment`, `allergies`, `chronic_conditions`, `doctor_general_comment`) + 검수된 가이드 원문 + 사용자 질문(`question`, `category`)

### 시스템 프롬프트 (초안)

```
당신은 AAC 웰니스 클리닉의 사후관리 Q&A 도우미입니다.
아래 카테고리 범위 안에서만 답변하세요: 세안·샤워, 화장·렌즈, 운동·사우나,
음주·흡연, 화장품·성분, 증상.

규칙:
- 답변은 "검수된 가이드"와 "환자 정보"에서만 근거를 찾으세요.
- 근거가 부족하거나 이 서비스 범위를 벗어난 질문이면 status를
  "out_of_scope"로 반환하고 answer는 비워두세요.
- 질환 진단, 회복 완료 판정, 약물 처방에 해당하는 답을 만들지 마세요.
- 환자의 알러지/기저질환과 관련된 질문이면 반드시 그 정보를 반영해 답하세요.
- 반드시 아래 JSON 스키마로만 응답하세요.
```

### 출력 스키마 (구조화 출력)

```json
{
  "status": "answered | out_of_scope",
  "answer": "string | null"
}
```
- `expert_required`는 이미 규칙 단계에서 결정되어 LLM에 도달하지 않는다 — LLM은 `answered`/`out_of_scope` 둘 중 하나만 선택
- 응답에는 서버가 `answeredBy: "llm"`, `basedOn: {careRecordId, daysElapsed, guideId}`를 붙여 최종 반환

### 실패 처리
`503 ANSWER_GENERATION_FAILED` — 재시도 안내 메시지 반환 (daily-guide와 달리 질문마다 다르므로 고정 폴백 문구를 만들기 어려움)

---

## 프롬프트 버전 관리 (추후 확장)

현재는 `generated_by` / `answered_by`가 `'llm'` 고정값이다. 프롬프트나 모델을 바꿔가며 실험하게 되면 `prompt_version`, `model_name` 컬럼을 `aftercare_guides`/`questions`에 추가해 어떤 버전이 어떤 답을 냈는지 추적할 수 있게 확장한다 (지금은 MVP 범위 밖).

## 구현 시 확정된 사항 (server/ 참고)
- LLM 모델: Anthropic Claude API (`ANTHROPIC_MODEL` 환경변수로 지정, 기본값 `claude-sonnet-5`)
- 검수된 가이드(RAG 소스) 저장 위치: DB 테이블 `public.reference_guides`로 확정 (`docs/db-schema.md` 참고)
- 출력 검증 실패 시 정책: **1회 재시도 → 그래도 실패하면** daily-guide는 `reference_guides` 원문으로 폴백(200), questions는 `503 ANSWER_GENERATION_FAILED` — `server/src/services/aftercare.service.ts`
- 구조화 출력 강제 방식: Claude tool use(`tool_choice: {type:"tool"}`)로 구현 (`server/src/services/llm/client.ts`)

## 미확정 사항
- 위험 신호 키워드 목록의 구체적 범위 — `server/src/lib/riskKeywords.ts`에 초안만 작성, 전문가(의료진) 검수 필요
- 실제 프롬프트 품질(정확성·톤)은 데모 데이터로만 검증됨 — 실 사용자 대상 테스트 필요
