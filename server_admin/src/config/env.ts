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

  // 클리닉 관리자 로그인 토큰 서명용. server/의 Supabase Auth와 무관한 별도 발급 체계.
  ADMIN_JWT_SECRET: z.string().min(16),

  // 시술 등록 즉시 알림(예약/오늘시술) 발송용 — server/의 FCM 설정과 동일한 값을 각자 보관한다
  // (프로세스가 분리돼 있어 공유 불가). 없어도 서버는 기동하고 알림만 스킵.
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
