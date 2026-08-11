import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  CORS_ORIGIN: z.string().default("*"),

  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_ANON_KEY: z.string().min(1),

  // 비밀번호 재설정 이메일의 딥링크 대상 (Android 앱이 이 URL을 가로채 recoveryToken을 추출).
  // 미설정 시 Supabase 프로젝트의 기본 Site URL로 전송됨 — 앱 딥링크 스킴 확정 후 채워도 됨.
  PASSWORD_RESET_REDIRECT_URL: z.string().url().optional(),

  ANTHROPIC_API_KEY: z.string().min(1),
  ANTHROPIC_MODEL: z.string().default("claude-sonnet-5"),

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
