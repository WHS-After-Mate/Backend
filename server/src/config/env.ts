import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  CORS_ORIGIN: z.string().default("*"),

  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_ANON_KEY: z.string().min(1),

  // phoneVerifiedToken 서명용 (회원가입 단계 전용, Supabase JWT와 별개)
  APP_TOKEN_SECRET: z.string().min(16),

  ANTHROPIC_API_KEY: z.string().min(1),
  ANTHROPIC_MODEL: z.string().default("claude-sonnet-5"),

  SMS_PROVIDER_API_KEY: z.string().optional(),
  SMS_PROVIDER_SENDER: z.string().optional(),
  SMS_DEV_MODE: z
    .string()
    .default("true")
    .transform((v) => v === "true"),

  FIREBASE_SERVICE_ACCOUNT_JSON: z.string().optional(),
  FCM_ENABLED: z
    .string()
    .default("false")
    .transform((v) => v === "true"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error("환경변수 검증 실패:", parsed.error.flatten().fieldErrors);
  throw new Error("Invalid environment configuration — .env.example 참고");
}

export const env = parsed.data;
