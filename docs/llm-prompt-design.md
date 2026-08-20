# WHS After Mate — LLM 프롬프트 설계 (v0.6)

v0.6 변경 (2026-08-20, 버그 수정): "미확정 사항"에 있던 시술명 표기 불일치(`튠 콩피에르®`/`레이저 제모 솔루션`)를 정식 명칭으로 통일해 해소. 아래 "미확정 사항" 절 참고.

v0.5 변경 (2026-08-19~20): **daily-guide가 LLM 호출 지점에서 완전히 빠졌다.** v0.4에서 "근거는 시술·환자 정보"로 원칙을 바꿨던 것이 과도기였다는 게 드러났다 — `care_type` 그룹 단위로는 같은 그룹 안에서도(예: `botox`의 근육형/피부형) 시술마다 실제 사후관리가 다르다는 문제의 근본 원인이 "LLM이 얼마나 잘 종합하느냐"가 아니라 "그룹 단위 근거 자체가 시술 단위 사실과 안 맞는다"는 데 있었다. 그래서 아예 시술명(`care_name`)+경과일 단위로 팀이 직접 콘텐츠를 작성해 DB(`treatment_guides`)에 저장하고, `GET /aftercare/daily-guide`는 그걸 그대로 조회만 하는 구조로 바뀌었다 — **LLM 호출도, "생성 실패 시 폴백"도 없다.** `reference_guides`/`aftercare_guides` 테이블은 삭제됐다. questions는 여전히 LLM을 호출하지만 근거 소스가 `reference_guides`→`treatment_guides`로 바뀌었다. 이제 LLM 호출 지점은 **questions**와 **recommendation** 두 곳뿐이다. 아래 "1. daily-guide" 절, "미확정 사항" 절 참고.

v0.4 변경 (2026-08-19): `docs/prompt.docx`(사용자 팀이 작성한 프롬프트 재설계안)를 세 프롬프트 전부에 반영. *(과도기 변경 — v0.5에서 daily-guide는 결국 LLM 호출 자체가 없어졌다. 아래 내용은 v0.4 시점의 역사적 기록으로 남긴다.)*
- **daily-guide 설계 철학 전환** — 기존 원칙 1번("근거는 오직 검수된 가이드와 환자 컨텍스트뿐")을 폐기했다. `reference_guides` 원문에 시술별 특성을 반영 못 하는 일반론이 섞여있는 문제가 다수 확인돼(예: `botox` care_type이 근육 주입형/피부층 주입형이라는 서로 다른 시술을 같은 문구로 묶는 등), 이제는 LLM이 시술·환자 정보를 근거로 직접 종합해서 생성한다. 출력 필드도 `mustAvoid`/`basicCare`/`nextCheckDate` → **`precautions`/`aftercare`/`keyCare`**로 전면 교체(하위호환 없음). `reference_guides`는 LLM 실패 시 폴백 용도로만 남는다.
- **questions에 `consultationLevel` 추가** — `status`(answered/out_of_scope)와 별개 축으로, LLM이 판단한 상담 필요도(`NONE`/`RECOMMENDED`/`URGENT`)를 함께 반환한다. 애매한 증상 질문을 무조건 `out_of_scope`로 막지 않고, 가능한 범위까지 답변한 뒤 상담 필요도로 구분하는 방향.
- **recommendation few-shot 예시 수정** — 기존 프롬프트의 모범 예시("리프팅·탄력 목표와 직접 연결돼요" 류)가 실제로는 "추천 이유가 뻔하다"는 피드백의 원인이었음이 확인돼, 이 문장들을 "피해야 할 예시"로 재배치하고 시술 `description` 기반의 구체적 효과 서술을 요구하는 규칙/예시로 교체.

기준: `api-spec.md` v0.16, `db-schema.md` v0.10. LLM은 **2곳**에서 호출된다: `POST /aftercare/questions`(챗봇 Q&A, 매 요청), `GET /recommendations/next-care`(및 상세) — 다음 관리 추천 사유/설명 생성. **`GET /aftercare/daily-guide`는 v0.5부터 LLM을 호출하지 않는다**(`treatment_guides` 직접 조회, 아래 "1. daily-guide" 절 참고). 그 외 모든 검증(카테고리, 위험 신호)은 **LLM 호출 전에 규칙 기반으로** 처리하며, 추천의 "어떤 시술을 고를지" 자체도 여전히 규칙 기반(§3 참고)이다.

---

## 공통 원칙

1. **근거는 시술·환자 정보 + 팀이 직접 작성한 콘텐츠** `(v0.5 변경)`: questions(챗봇)는 시술 정보(관리명·부위·의사 코멘트)와 환자 컨텍스트(알러지·기저질환)에 더해 `treatment_guides`(시술명+경과일 단위로 팀이 직접 작성한 콘텐츠)를 근거로 LLM이 답변을 종합한다. daily-guide는 `(v0.5)` 아예 LLM을 거치지 않고 `treatment_guides`를 그대로 반환한다(아래 "1. daily-guide" 절). 확실하지 않은 내용·수치는 지어내지 않는다는 원칙은 questions/recommendation에 계속 적용.
2. **의료적 진단·처방 금지**: 질환명 진단, 회복 완료 판정, 약물 처방, 응급 상태 단독 판단을 생성하지 않는다.
3. **위험 신호·범위 밖 카테고리는 LLM에 도달하기 전에 걸러진다**: 비용·안전 모두를 위해 규칙 엔진이 먼저 처리하고, LLM은 "안전하다고 확인된 요청"만 받는다.
4. **구조화된 출력 강제**: LLM을 호출하는 두 엔드포인트(questions/recommendation) 모두 고정된 JSON 스키마로만 응답받는다(모델의 함수 호출 사용). 자유 텍스트 응답을 파싱하지 않는다.
5. **알러지·의사 코멘트는 항상 컨텍스트에 포함**: "환자가 알러지 있는 성분을 권하는" 실수를 막기 위해 LLM을 호출하는 프롬프트는 이 필드를 필수로 주입한다. `medical_data_access_log`에 `accessed_by: 'llm_system'`으로 접근 기록을 남긴다.

---

## 파이프라인 (questions/recommendation 공통 순서 — daily-guide는 LLM을 호출하지 않아 별도, 아래 "1. daily-guide" 절 참고)

```
① 규칙 기반 사전 필터
   - questions: category가 지원 6종인가? (422 UNSUPPORTED_CATEGORY)
                질문에 위험 신호 키워드가 있는가? (status: expert_required, LLM 미호출)
② 컨텍스트 조립
   - care_records (+ doctor_comment), medical_profiles (allergies, chronic_conditions, doctor_general_comment)
   - questions는 여기에 treatment_guides(시술명+경과일 매칭 콘텐츠)도 함께 조립
③ LLM 호출 (시스템 프롬프트 + 컨텍스트 + 구조화 출력 스키마)
④ 출력 검증
   - 금지어(진단/처방 관련 문구) 필터링
   - 스키마 검증 실패 시 1회 재시도, 계속 실패하면 503(questions) 또는 정적 템플릿 폴백(recommendation)
⑤ 저장 / 응답
   - questions → questions 테이블에 insert
```

---

## 1. `GET /aftercare/daily-guide` — LLM을 호출하지 않는 단순 조회 `(v0.5부터)`

**이 절은 프롬프트가 없다는 사실 자체가 내용이다.** v0.4까지는 이 엔드포인트가 daily-guide 프롬프트로 LLM을 호출했지만(과거 프롬프트 전문은 아래 "왜 없어졌나" 참고), v0.5(`server/db/migrations/023_add_treatment_guides.sql`, `024_drop_care_type.sql`)부터는 다음과 같이 동작한다:

1. `care_records.care_name` + 요청된 경과일(`elapsedDay`, 생략 시 실제 경과일)로 `treatment_guides` 테이블을 `(care_name, day)` 정확히 일치 조회
2. 매칭되는 행이 있으면 `aftercare`/`precautions`/`key_care`를 그대로 응답에 담아 반환(`generatedBy: "treatment_guide"`)
3. 매칭되는 행이 없으면 — LLM 폴백도, 근사 매칭도 없이 — 바로 `404 GUIDE_NOT_AVAILABLE`

`treatment_guides`는 시술 46종 전체를 팀이 직접 작성해 채운 테이블이라(`server/db/seed/seedTreatmentGuides.ts`), day가 1/3/5/7/14 다섯 값이고 `careName` 표기가 정확히 일치하는 한 404가 나올 일이 거의 없다. 자세한 테이블 스키마는 `db-schema.md`의 "public.treatment_guides" 절 참고, API 계약(필드/에러)은 `api-spec.md`의 "GET /aftercare/daily-guide" 절 참고.

### 왜 없어졌나

v0.4는 "근거를 `reference_guides`(검수된 원문)에서 LLM이 직접 종합"으로 바꿔서, `care_type` 그룹 하나가 서로 다른 시술(예: `botox`의 근육 주입형 `초음파™ 보톡스` vs 피부층 주입형 `스킨 보톡스`)을 같은 문구로 묶는 문제를 LLM의 판단력으로 완화하려 했다. 그런데 이 역시 근본 해결은 아니었다 — LLM이 아무리 잘 종합해도, 애초에 주입되는 "사실 근거" 자체가 `care_type` 그룹 단위라 시술 고유의 특성을 담지 못하는 건 여전했다. 결국 그룹 단위 근거 자체를 버리고 시술명 단위로 팀이 직접 콘텐츠를 쓰는 쪽으로 방향을 바꿨다 — 이러면 LLM이 종합할 필요 자체가 없어진다(이미 시술 단위로 정확한 콘텐츠니까). 부수 효과로 매 요청 LLM 호출 비용도 없어졌다.

### v0.4 시점의 프롬프트 (역사적 기록, 더 이상 코드에 없음)

`server/src/services/llm/dailyGuide.prompt.ts`는 v0.5에서 삭제됐다. 아래는 v0.4~v0.5 과도기에 실제로 쓰였던 시스템 프롬프트 전문이다 — questions/recommendation 프롬프트를 손볼 때 톤·제약 표현의 참고용으로만 남긴다.

```
당신은 AAC 웰니스 클리닉의 사후관리 안내 도우미입니다.
아래 "시술 정보"와 "환자 정보"를 바탕으로, 해당 환자의 현재 경과일에 맞는 사후관리 정보를
안내하세요.

규칙:
- 시술 종류와 현재 경과일을 가장 우선적으로 고려하세요.
- 질환을 진단하거나, 회복 완료를 의학적으로 판정하거나, 약물을 처방하지 마세요.
- 확실하지 않은 내용은 단정하거나 구체적인 수치·기간을 임의로 만들어내지 마세요.
- 환자의 알러지/기저질환 정보가 질문 및 사후관리와 관련이 있다면 반드시 반영하세요.
- 사후관리가 필요한 기간이라면 현재 시점에서 중요한 내용만 선별하세요.
- 단순한 상식이나 모든 시술에 공통으로 적용되는 일반론은 우선순위에서 제외하세요.
  예: "시술 부위를 압박하지 마세요", "청결을 유지하세요", "무리하지 마세요"
- 사용자가 별도로 안내받지 않으면 놓치기 쉬운 실제 생활 관련 내용을 우선하세요.
- 시술 특성상 주요 사후관리 기간이 지난 시점이라고 판단되는 경우, 억지로 항목을 생성하지
  마세요. 이 경우 keyCare에는 현재 일상생활 복귀가 가능한 시점이라는 내용을 간단히 안내하고,
  aftercare와 precautions는 빈 배열 []로 반환하세요. 단, 회복이 완전히 끝났다고 단정하지
  마세요.

사후관리가 필요한 경우:
- aftercare는 현재 경과일에 가장 중요한 사후관리 방법 정확히 3개를 작성하세요.
- precautions는 현재 경과일에 가장 중요한 주의사항 정확히 3개를 작성하세요.
- 각 항목은 서로 겹치지 않게 작성하세요.
- keyCare는 오늘 가장 중요하게 기억해야 할 내용을 한 문장으로 요약하세요.
- 각 문장은 짧고 구체적으로 작성하세요.

반드시 도구 호출(tool call)로만 응답하세요. 다른 텍스트를 추가하지 마세요.
```

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
`care_name`, `days_elapsed`, `doctor_comment`(`care_records`), `allergies`/`chronic_conditions`/`doctor_general_comment`(`medical_profiles`) + **`treatment_guides`의 콘텐츠**(JSON 페이로드 키는 `reviewedGuide` 그대로 유지 — `db-schema.md`의 "public.treatment_guides" 절 참고. `(v0.5)` 소스만 `reference_guides`→`treatment_guides`로 바뀌었고 필드명은 유지) + 사용자 질문(`question`, `category`)

### 시스템 프롬프트 `(v0.4, docs/prompt.docx 반영 — consultationLevel 신규)`

```
당신은 AAC 웰니스 클리닉의 사후관리 Q&A 도우미입니다.
아래 카테고리 범위 안에서만 답변하세요: 세안·샤워, 화장·렌즈, 운동·사우나,
음주·흡연, 화장품·성분, 증상.

규칙:
- 제공된 시술 정보, 환자 정보, 현재 경과일을 우선적으로 고려해 답변하세요.
- 질문한 시술과 다른 시술의 사후관리 정보를 섞어서 답하지 마세요.
- 일반적인 사후관리 수준에서 답변하되, 확실하지 않은 내용이나 구체적인 기간·수치를 임의로
  만들어내지 마세요.
- 서비스 범위를 벗어난 질문은 status를 out_of_scope로 반환하고 answer는 비워두세요.
- 질환 진단, 회복 완료 여부, 시술 결과의 정상·비정상 판정, 약물 처방 또는 변경을 하지 마세요.
- 사용자의 현재 상태를 직접 보거나 검사해야 판단할 수 있는 내용은 단정적으로 답하지 마세요.
- 증상 질문에는 가능한 범위의 일반적인 사후관리 정보까지만 안내하고, 실제 상태 판단이 필요한
  경우 consultationLevel을 RECOMMENDED 또는 URGENT로 설정하세요.
- 상담이 필요한 질문이라고 해서 무조건 out_of_scope로 처리하지 마세요. 사후관리 범위의
  질문이라면 가능한 범위까지 답변한 뒤 consultationLevel로 상담 필요도를 구분하세요.
- 일상적인 사후관리 질문은 consultationLevel을 NONE으로 설정하고 불필요하게 상담을 권유하지
  마세요.
- 환자의 알러지 또는 기저질환 정보가 제공되어 있고 질문과 관련이 있다면 반드시 반영하세요.
  알러지나 기저질환 정보가 없으면 임의로 존재한다고 가정하지 마세요.
- 환자의 관리명과 관리 후 경과일이 답변에 관련되는 경우 자연스럽게 반영하세요.
- 사용자가 일상적인 표현, 오타, 줄임말 또는 같은 의미의 다른 표현을 사용해도 의도를 파악해서
  답변하세요.
- 답변은 사용자가 이해하기 쉬운 한국어로 간결하게 작성하세요.
- 불필요하게 "병원에 문의하세요"라는 문장을 모든 답변에 반복하지 마세요.
- 반드시 도구 호출(tool call)로만 응답하세요.

consultationLevel 기준:
- NONE: 일반적인 사후관리 정보만으로 충분히 답변할 수 있는 경우
- RECOMMENDED: 실제 상태 확인이 있어야 정확한 판단이 가능한 경우
- URGENT: 빠른 전문적 확인이 필요할 가능성이 있는 증상이 언급된 경우
```

**왜 바뀌었나**: 위험 신호 키워드(통증 증가·출혈 등)에 안 걸린 애매한 증상 질문("며칠째 붓기가 안 빠지는데 괜찮은 걸까요?" 같은)은 기존엔 LLM이 `answered`/`out_of_scope` 둘 중 하나만 고를 수 있었다 — 상담이 필요해 보이면 답변 자체를 포기하고 `out_of_scope`로 처리하기 쉬운 구조였다. `consultationLevel`을 `status`와 별개 축으로 분리해서, "일단 가능한 범위까지는 답하고, 상담 필요도는 따로 표시"하는 게 가능해졌다.

### 출력 스키마 (구조화 출력) `(v0.4, consultationLevel 추가)`

```json
{
  "status": "answered | out_of_scope",
  "answer": "string | null",
  "consultationLevel": "NONE | RECOMMENDED | URGENT"
}
```
- `expert_required`는 이미 규칙 단계에서 결정되어 LLM에 도달하지 않는다 — LLM은 `answered`/`out_of_scope` 둘 중 하나만 선택
- `consultationLevel`은 `status`와 독립적인 값이다 — `status: out_of_scope`일 때도 스키마상 필드는 채워지지만, 서버는 이 경우 항상 `NONE`으로 강제 저장한다(LLM이 판단할 계기가 없으므로).
- `questions.consultation_level` 컬럼 신규 추가(마이그레이션 017, 기본값 `NONE`).
- 응답에는 서버가 `answeredBy: "llm"`, `basedOn: {careRecordId, daysElapsed, guideId}`를 붙여 최종 반환

### 실패 처리
`503 ANSWER_GENERATION_FAILED` — 재시도 안내 메시지 반환 (daily-guide와 달리 질문마다 다르므로 고정 폴백 문구를 만들기 어려움)

---

## 3. `GET /recommendations/next-care`(및 `/recommendations/next-care/{id}`) — 추천 사유/설명 생성 `(v0.2, 2026-08-18 신규)`

### 다른 두 엔드포인트와의 차이
daily-guide/questions는 "무엇을 답할지" 자체를 LLM이 정하지만, 추천은 **어떤 시술을 추천할지(후보 선정)는 여전히 규칙 기반**이다(관심 목표·최근 시술과 `procedures.category_tags` 매칭 점수, `recommendations.service.ts`의 `scoreProcedures`). LLM은 이미 정해진 1개 시술에 대해 "왜 추천하는지" 자연어 문구만 생성한다 — 잘못된 시술을 추천할 위험은 LLM과 무관하다.

### 호출 시점
- `reasons`: `computeNextCareRecommendation` 호출마다 (즉 `GET /next-care`, `GET /next-care/{id}`, `GET /home/summary` 전부) — 캐싱 없음
- `detailDescription`: 상세 조회에서마다 호출. `(v0.3 변경)` 이전엔 추천 시술에 `procedures.description`(카탈로그 큐레이션 문구)이 있으면 그걸 그대로 썼으나, 카탈로그 원문은 길이가 들쭉날쭉해 화면에서 깨지는 문제가 있어 — 이제 항상 LLM에게 그 카탈로그 설명을 "근거"로 전달하고, 앱 화면에 맞는 짧은 한 줄로 압축시킨다. LLM 실패/미설정 시엔 카탈로그 원문을 40자로 잘라 폴백.

### 컨텍스트 주입 필드

| 필드 | 출처 | 용도 |
|---|---|---|
| 추천 시술명·설명·카테고리태그 | `procedures` | LLM이 언급할 수 있는 유일한 "사실" |
| `interestGoals`, 관심목표와 겹치는 태그 | `profiles.interest_goals` + 매칭 결과 | 왜 이 고객에게 맞는지 연결고리 |
| 최근 관리명 | `care_records` | 최근 이력과의 연관성 언급 |

### 시스템 프롬프트 (`server/src/services/llm/recommendation.prompt.ts`) `(v0.4, docs/prompt.docx 반영)`

```
당신은 AAC 웰니스 클리닉의 다음 관리 추천 도우미입니다.
아래 "추천된 시술 정보"와 "고객 정보"만을 근거로, 사용자가 이 관리를 받으면 구체적으로 어떤
부분에 도움을 기대할 수 있는지 짧은 한국어 문장으로 설명하세요.

규칙:
- 주어진 정보에 없는 효능·효과를 절대 지어내지 마세요.
- 의료적 진단이나 시술 효과를 보장하는 표현은 사용하지 마세요.
- reasons는 정확히 3개, 각각 30자 이내로 작성하세요.
- 추천 시술의 description에 명시된 효과·관리 목적을 가장 우선적으로 활용하세요.
- 이유는 가능하면 개선 대상 + 기대 효과 형태로 작성하세요.
- 사용자가 읽었을 때 "그래서 이 관리를 받으면 무엇이 좋아지는지" 바로 알 수 있어야 합니다.
- "관심 목표와 연결돼요", "잘 맞는 관리예요", "자연스러운 다음 단계예요", "함께 기대할 수
  있어요"처럼 구체적인 효과가 없는 표현은 사용하지 마세요.
- interestGoals, goalOverlapWithProcedure는 이유 자체로 그대로 반복하지 말고, 추천 시술의
  description에 근거한 구체적인 효과와 연결해서 표현하세요.
- latestCareName, recentCareNames만을 근거로 두 시술의 궁합, 시너지, 순서 또는 "다음 단계"라고
  추론하지 마세요.
- 제공된 정보만으로 구체적인 효과를 설명할 수 없는 경우에는 새로운 효능을 만들어내지 말고,
  주어진 description과 categoryTags 범위에서만 표현하세요.
- 세 문장은 의미가 서로 겹치지 않도록 작성하세요.
- detailDescription은 추천 시술의 핵심 관리 목적을 30자 안팎 한 문장으로 요약하세요.
- 반드시 도구 호출(tool call)로만 응답하세요. 다른 텍스트를 추가하지 마세요.

좋은 출력 예시: "턱선과 얼굴 라인 정리에 도움을 줘요" / "피부 탄력 관리에 도움을 줄 수 있어요"
피해야 할 출력 예시: "리프팅·탄력 목표와 직접 연결돼요" / "고객님께 잘 맞는 관리예요"
```

**왜 바뀌었나**: `(v0.3까지)`의 few-shot 모범 예시가 바로 "리프팅·탄력 목표와 직접 연결돼요" 류였다 — "추천 이유가 짧고 뻔하다"는 피드백의 원인이 이 예시 자체였던 것으로 확인돼, `(v0.4)`에서 이 문장들을 정반대로 "피해야 할 예시"로 재배치하고, 시술 `description`에 명시된 구체적 효과를 우선 활용하도록 규칙을 다시 작성했다.

### 출력 스키마 (구조화 출력)

```json
{
  "reasons": ["string"],
  "detailDescription": "string"
}
```
`(v0.3)` JSON 스키마에도 `reasons: {minItems:3, maxItems:3, items:{maxLength:30}}`, `detailDescription: {maxLength:40}` 힌트를 함께 전달하지만, 모델이 이를 항상 엄격히 지키지는 않으므로 코드 레벨 안전장치가 있다(`recommendations.service.ts`): `reasons.length !== 3`이면 재시도, 각 문자열은 `truncate()`로 30자/40자 초과분을 강제로 자른다.

### 실패 처리
`503` 없음 — 1회 재시도 후에도 실패하거나 `OPENAI_API_KEY` 미설정이면 기존 정적 템플릿 문구(관심목표/최근관리 겹침 여부로 조합한 고정 문장)로 조용히 폴백한다. 추천 자체가 안 뜨는 일은 없다.

---

## 프롬프트 버전 관리 (추후 확장)

`(v0.5)` LLM을 호출하는 지점이 questions 하나로 줄면서(daily-guide는 이제 LLM을 호출하지 않고, recommendation은 애초에 결과를 저장하지 않음), 버전 관리 대상도 `questions.answered_by`(`'llm'` 고정값) 하나뿐이다. 프롬프트나 모델을 바꿔가며 실험하게 되면 `prompt_version`, `model_name` 컬럼을 `questions`에 추가해 어떤 버전이 어떤 답을 냈는지 추적할 수 있게 확장한다 (지금은 MVP 범위 밖).

## 구현 시 확정된 사항 (server/ 참고)
- LLM 모델: OpenAI API (`OPENAI_MODEL` 환경변수로 지정, 기본값 **`gpt-4.1-mini`** `(v0.3, 2026-08-18 변경)`)
  - 최초엔 `gpt-4o-mini`로 시작했다가, 해커톤 크레딧을 더 활용하고자 "미니가 아닌" 모델(`gpt-5.4`)로 바꿨으나, 실제 배포 환경에서 홈/추천 화면 로딩이 30초를 넘겨 타임아웃되는 장애가 발생 — 원인을 실측한 결과 `gpt-5.4`가 계정 기준 **일일 50 요청**의 하드 레이트리밋에 걸려 있었고(크레딧 잔액과 무관한 모델별 제한), 여기에 OpenAI SDK의 기본 재시도(지수 백오프, `maxRetries:2`)가 애플리케이션 자체의 재시도 루프와 중첩되어 응답이 24초까지 늘어지는 걸로 확인됐다. `gpt-4.1-mini`는 같은 계정에서 레이트리밋에 걸리지 않아 최종 채택 — 벤치마크로 24132ms → 1381ms 개선 확인.
  - `server/src/config/openai.ts`에서 `new OpenAI({ apiKey, maxRetries: 0 })`로 SDK 자체 재시도를 꺼서, 위 "SDK 재시도 + 앱 재시도 중첩" 문제를 구조적으로 방지(앱 레벨 1회 재시도만 남김).
- 사후관리 콘텐츠(RAG 소스) 저장 위치: `(v0.5)` DB 테이블 `public.treatment_guides`로 확정 — 시술명(`care_name`)+경과일(`day`) 단위, 팀이 직접 작성(검수 워크플로 없음, 애초에 팀 작성 콘텐츠라 "검수 대기" 상태가 없음). *(v0.4까지는 `public.reference_guides`, `care_type` 그룹 단위였다 — 그 테이블은 `024`에서 삭제됐다.)* `docs/db-schema.md` 참고
- 출력 검증 실패 시 정책: **1회 재시도 → 그래도 실패하면** questions는 `503 ANSWER_GENERATION_FAILED`, recommendation은 정적 템플릿 폴백(200) — `server/src/services/aftercare.service.ts`/`recommendations.service.ts`. **daily-guide는 `(v0.5)` 애초에 LLM을 호출하지 않으므로 이 정책 자체가 해당 없음** — 매칭 실패는 곧바로 `404 GUIDE_NOT_AVAILABLE`
- 구조화 출력 강제 방식: OpenAI function calling(`tool_choice: {type:"function"}`)로 구현 (`server/src/services/llm/client.ts`) — questions/recommendation **2곳**이 이 공통 `callStructuredLlm` 함수를 재사용(`(v0.5)` daily-guide는 더 이상 LLM을 호출하지 않아 제외됨)
- GPT-5 계열은 `max_tokens` 대신 `max_completion_tokens`를 요구하고, 추론 전용 모델(`gpt-5`/`gpt-5-mini`)은 강제 tool-calling과 궁합이 안 맞아(낮은 토큰 예산에서 답변 대신 숨은 추론에 토큰을 다 씀) 후보에서 제외했다.
- `(v0.4)` 세 프롬프트 전부 `docs/prompt.docx`(사용자 팀 작성 재설계안)를 코드에 반영 완료. daily-guide는 전면 재설계(공통 원칙 1번 변경 포함), questions는 `consultationLevel` 추가, recommendation은 시스템 프롬프트 교체(스키마·컨텍스트 구조는 기존과 동일).

## 미확정 사항
- 위험 신호 키워드 목록의 구체적 범위 — `server/src/lib/riskKeywords.ts`에 초안만 작성, 전문가(의료진) 검수 필요
- 실제 프롬프트 품질(정확성·톤)은 데모 데이터로만 검증됨 — 실 사용자 대상 테스트 필요
- ~~`reference_guides`의 care_type 7종 중 5종이 미검수 스텁인 문제~~ — **v0.5에서 해소됨.** `reference_guides` 테이블 자체가 삭제되고 `treatment_guides`(시술명 단위, 팀이 직접 작성)로 대체되며 "검수 여부가 구분 안 되는" 문제의 전제(검수 워크플로가 있는데 코드가 검사 안 함)가 사라졌다 — 애초에 전부 팀 작성 콘텐츠라 검수 대기 상태 자체가 없음
- ~~`treatment_catalog`의 `botox` care_type이 서로 다른 시술을 묶는 문제~~ — **v0.5에서 해소됨.** `care_type` 그룹 단위 매칭 자체가 없어지고 시술명(`care_name`) 단위 직접 매칭으로 바뀌면서, `초음파™ 보톡스`(근육 주입형)와 `스킨 보톡스`(피부층 주입형)가 각각 자기 시술명으로 독립된 `treatment_guides` 콘텐츠를 갖는다 — 애초에 이 문제의 원인이었던 "그룹 공유" 구조 자체가 없어짐
- ~~이름 불일치: `treatment_catalog`의 `튠 콩피에르®`/`레이저 제모 솔루션`이 실제 엑셀 원본(`튠 콩피에르(Tune Confier)`/`레이저 제모`)과 다르게 등록돼 있음~~ — **v0.6에서 해소됨.** 정식 명칭(`튠 콩피에르®`/`레이저 제모 솔루션`, 실제 EMR 이관 데이터가 쓰던 표기)으로 통일하는 쪽으로 결정 — `treatment_catalog`/`procedures`/`treatment_guides` 세 테이블의 시드 스크립트와 실제 DB 데이터를 전부 이 표기로 맞췄다. 실제로 이미 이 이름 불일치 때문에 daily-guide가 `404`로 실패하던 실사용 사례(`care_records`에 `레이저 제모 솔루션`으로 등록된 시술기록)가 있었음을 확인·해결
