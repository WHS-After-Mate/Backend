export interface RecommendationContext {
  careName: string;
  procedureDescription: string | null;
  categoryTags: string[];
  goalOverlap: string[];
  interestGoals: string[];
  latestCareName: string | null;
  recentCareNames: string[];
}

export const RECOMMENDATION_SYSTEM_PROMPT = `당신은 AAC 웰니스 클리닉의 다음 관리 추천 도우미입니다.
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

좋은 출력 예시:
- "턱선과 얼굴 라인 정리에 도움을 줘요"
- "피부 탄력 관리에 도움을 줄 수 있어요"
- "모공과 피지 관리에 도움을 줄 수 있어요"

피해야 할 출력 예시:
- "리프팅·탄력 목표와 직접 연결돼요"
- "최근 시술 이후 자연스러운 다음 단계예요"
- "고객님께 잘 맞는 관리예요"
- "모공·피지 관리도 함께 기대할 수 있어요"`;

export const RECOMMENDATION_TOOL_NAME = "submit_recommendation_copy";

export const RECOMMENDATION_INPUT_SCHEMA = {
  type: "object",
  properties: {
    reasons: {
      type: "array",
      items: { type: "string", maxLength: 30 },
      minItems: 3,
      maxItems: 3,
      description: "추천 이유. 정확히 3개, 각 30자 이내의 짧고 구체적인 문장",
    },
    detailDescription: {
      type: "string",
      maxLength: 40,
      description: "추천 상세 화면에 한 줄로 보여줄 설명, 30자 안팎",
    },
  },
  required: ["reasons", "detailDescription"],
} as const;

export function buildRecommendationUserMessage(ctx: RecommendationContext): string {
  return JSON.stringify({
    recommendedProcedure: {
      name: ctx.careName,
      description: ctx.procedureDescription,
      categoryTags: ctx.categoryTags,
    },
    patient: {
      interestGoals: ctx.interestGoals,
      goalOverlapWithProcedure: ctx.goalOverlap,
      latestCareName: ctx.latestCareName,
      recentCareNames: ctx.recentCareNames,
    },
  });
}

export interface RecommendationLlmOutput {
  reasons: string[];
  detailDescription: string;
}
