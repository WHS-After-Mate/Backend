import type Anthropic from "@anthropic-ai/sdk";
import { ANTHROPIC_MODEL, anthropic } from "../../config/anthropic";

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
  const response = await anthropic.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: params.maxTokens ?? 1024,
    system: params.system,
    messages: [{ role: "user", content: params.userMessage }],
    tools: [
      {
        name: params.toolName,
        description: params.toolDescription,
        input_schema: params.inputSchema as Anthropic.Tool["input_schema"],
      },
    ],
    tool_choice: { type: "tool", name: params.toolName },
  });

  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("LLM이 구조화 출력을 반환하지 않았습니다.");
  }

  return toolUse.input as T;
}
