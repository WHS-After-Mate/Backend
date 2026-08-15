import { supabaseAdmin } from "../config/supabase";
import { Errors } from "../lib/errors";
import { issueAdminToken, verifyPassword } from "../lib/adminAuth";

export async function login(username: string, password: string) {
  const { data: account, error } = await supabaseAdmin
    .from("admin_accounts")
    .select("*")
    .eq("username", username)
    .maybeSingle();
  if (error) throw Errors.internal(error.message);
  if (!account) throw Errors.invalidCredentials();

  const passwordOk = await verifyPassword(password, account.password_hash);
  if (!passwordOk) throw Errors.invalidCredentials();

  const token = issueAdminToken({
    adminId: account.id,
    username: account.username,
    brand: account.brand,
  });

  return { token, username: account.username, brand: account.brand };
}
