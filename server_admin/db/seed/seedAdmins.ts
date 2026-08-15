import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 .env에 설정되어 있어야 합니다.");
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// 클리닉이 3개로 고정이라 계정도 3개 고정 — 테스트 목적이라 아이디/비밀번호를 클리닉명과 동일하게 맞춰
// 헷갈리지 않게 한다(운영 전환 시 반드시 교체해야 함).
const ADMIN_ACCOUNTS = [
  { username: "amred", password: "amred1234", brand: "AMRED CLINIC" },
  { username: "derna", password: "derna1234", brand: "DERNA CLINIC" },
  { username: "wim", password: "wim1234", brand: "WIM Clinic" },
];

async function main() {
  console.log("[seedAdmins] 클리닉 관리자 계정 3개 생성/갱신 중...");

  for (const account of ADMIN_ACCOUNTS) {
    const passwordHash = await bcrypt.hash(account.password, 10);
    const { error } = await supabase.from("admin_accounts").upsert(
      {
        username: account.username,
        password_hash: passwordHash,
        brand: account.brand,
      },
      { onConflict: "username" },
    );
    if (error) throw new Error(`[${account.username}] 생성 실패: ${error.message}`);
    console.log(`  - ${account.username} / ${account.password} → ${account.brand}`);
  }

  console.log("[seedAdmins] 완료. 위 아이디/비밀번호로 POST /api/v1/auth/login 테스트 가능.");
}

main()
  .catch((err) => {
    console.error("[seedAdmins] 실패:", err.message);
    process.exit(1);
  })
  .finally(() => process.exit(0));
