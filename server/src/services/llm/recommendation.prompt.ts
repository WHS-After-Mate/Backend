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
아래 "추천된 시술 정보"와 "고객 정보"만을 근거로, 이 시술이 왜 추천되는지 자연스러운 한국어
문장으로 설명하세요.

규칙:
- 주어진 정보에 없는 효능·효과를 지어내지 마세요.
- 의료적 진단이나 시술 효과를 보장하는 표현은 쓰지 마세요.
- 관심 목표 또는 최근 관리와 겹치는 부분이 있으면 그 연결고리를 구체적으로 언급하세요.
- 반드시 도구 호출(tool call)로만 응답하세요. 다른 텍스트를 추가하지 마세요.`;

export const RECOMMENDATION_TOOL_NAME = "submit_recommendation_copy";

export const RECOMMENDATION_INPUT_SCHEMA = {
  type: "object",
  properties: {
    reasons: {
      type: "array",
      items: { type: "string" },
      description: "추천 이유. 1문장씩, 1~3개",
    },
    detailDescription: {
      type: "string",
      description: "추천 상세 화면에 보여줄 1~2문장 설명",
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
