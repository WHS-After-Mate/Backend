import { createClient } from "@supabase/supabase-js";
import { env } from "./env";

// server_admin은 admin-web에 별도 로그인이 없는 내부용 프로토타입이라(데모 범위 결정),
// 사용자 컨텍스트 검증이 필요 없다 — service-role 클라이언트 하나만 쓴다.
export const supabaseAdmin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
