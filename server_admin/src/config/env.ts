import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(4100),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  CORS_ORIGIN: z.string().default("*"),

  // server/와 동일한 Supabase 프로젝트를 가리켜야 한다 — emr_* 스테이징 테이블과
  // 회원가입 시 claim 대상인 profiles/care_records 등이 전부 같은 DB에 있다.
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error("환경변수 검증 실패:", parsed.error.flatten().fieldErrors);
  throw new Error("Invalid environment configuration — .env.example 참고");
}

export const env = parsed.data;
