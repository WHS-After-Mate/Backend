import OpenAI from "openai";
import { env } from "./env";

// maxRetries: 0 — SDK 자체 재시도(기본 2회, 지수 백오프 포함)를 끈다. callStructuredLlm이 이미
// 자체적으로 2회 재시도하므로, 둘 다 켜져 있으면 재시도가 겹겹이 쌓여 레이트리밋(429) 상황에서
// 응답까지 수십 초가 걸리는 문제가 있었다(2026-08-18 daily-guide 캐시 미스 시 24초 실측).
export const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY, maxRetries: 0 });
export const OPENAI_MODEL = env.OPENAI_MODEL;
