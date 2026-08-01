import Anthropic from "@anthropic-ai/sdk";
import { env } from "./env";

export const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
export const ANTHROPIC_MODEL = env.ANTHROPIC_MODEL;
