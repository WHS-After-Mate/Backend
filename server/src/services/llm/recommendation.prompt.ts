export interface RecommendationContext {
  careName: string;
  procedureDescription: string | null;
  categoryTags: string[];
  goalOverlap: string[];
  interestGoals: string[];
  latestCareName: string;
  recentCareNames: string[];
}

export const RECOMMENDATION_SYSTEM_PROMPT = `당신은 AAC 웰니스 클리닉의 다음 관리 추천 도우미입니다.
아래 "추천된 시술 정보"와 "고객 정보"만을 근거로, 이 시술이 왜 추천되는지 짧고 구체적인
한국어 문장으로 설명하세요.

규칙:
- 주어진 정보에 없는 효능·효과를 지어내지 마세요.
- 의료적 진단이나 시술 효과를 보장하는 표현은 쓰지 마세요.
- reasons는 정확히 3개, 각각 30자 이내의 짧은 문장으로 작성하세요.
- "고민이 있으신 고객님께 잘 맞을 것 같아요" 같은 두루뭉술한 일반론은 쓰지 마세요. 대신
  겹치는 관심 목표 이름, 최근 받은 시술명을 직접 지목하는 식으로 구체적으로 쓰세요
  (예: "리프팅·탄력 목표와 직접 연결돼요", "티타늄 리프팅 이후 자연스러운 다음 단계예요").
- detailDescription은 30자 안팎의 한 문장으로 — 앱 화면에 한 줄로 표시되니 길게 쓰지 마세요.
- 반드시 도구 호출(tool call)로만 응답하세요. 다른 텍스트를 추가하지 마세요.`;

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
