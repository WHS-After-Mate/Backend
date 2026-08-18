import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  CORS_ORIGIN: z.string().default("*"),

  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_ANON_KEY: z.string().min(1),

  // 비밀번호 재설정 이메일에 같이 실리는 링크의 목적지. 실제 재설정은 이제 이메일의 6자리 코드로
  // 처리하므로(auth.service.ts의 confirmPasswordReset 참고) 이 링크 자체는 안 눌러도 되지만,
  // Supabase가 이메일 한 통에 링크+코드를 함께 발급하는 구조라 여전히 값이 필요하다.
  // 미설정 시 Supabase 프로젝트의 기본 Site URL로 전송됨 — 앱 딥링크 스킴 확정 후 채워도 됨.
  PASSWORD_RESET_REDIRECT_URL: z.string().url().optional(),

  // 없어도 서버 자체는 정상 기동한다 — daily-guide는 검수된 reference_guide로 폴백,
  // questions는 ANSWER_GENERATION_FAILED로 응답할 뿐(aftercare.service.ts) 그 외 엔드포인트는 무관.
  // 프론트 로컬 개발 시 이 키 없이도 회원가입/로그인/시술기록 등은 그대로 테스트 가능하게 하기 위함.
  OPENAI_API_KEY: z.string().min(1).optional(),
  OPENAI_MODEL: z.string().default("gpt-4.1-mini"),

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
