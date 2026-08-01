import { createClient } from "@supabase/supabase-js";
import { env } from "./env";

// service-role 클라이언트: RLS 우회, 백엔드 전용. user_id는 항상 애플리케이션 코드가 검증된 값으로 필터링한다.
export const supabaseAdmin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// anon 클라이언트: accessToken 검증(auth.getUser) 등 사용자 컨텍스트가 필요한 호출용
export const supabaseAnon = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
