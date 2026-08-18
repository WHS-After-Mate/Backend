import { OPENAI_MODEL, openai } from "../../config/openai";

interface StructuredCallParams {
  system: string;
  userMessage: string;
  toolName: string;
  toolDescription: string;
  inputSchema: Record<string, unknown>;
  maxTokens?: number;
}

// 구조화 출력 강제(공통 원칙 4) — 자유 텍스트를 파싱하지 않고 tool_choice로 스키마를 강제한다.
export async function callStructuredLlm<T>(params: StructuredCallParams): Promise<T> {
  const response = await openai.chat.completions.create({
    model: OPENAI_MODEL,
    max_completion_tokens: params.maxTokens ?? 1024,
    messages: [
      { role: "system", content: params.system },
      { role: "user", content: params.userMessage },
    ],
    tools: [
      {
        type: "function",
        function: {
          name: params.toolName,
          description: params.toolDescription,
          parameters: params.inputSchema,
        },
      },
    ],
    tool_choice: { type: "function", function: { name: params.toolName } },
  });

  const toolCall = response.choices[0]?.message.tool_calls?.[0];
  if (!toolCall || toolCall.type !== "function" || toolCall.function.name !== params.toolName) {
    throw new Error("LLM이 구조화 출력을 반환하지 않았습니다.");
  }

  return JSON.parse(toolCall.function.arguments) as T;
}
