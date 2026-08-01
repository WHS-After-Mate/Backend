import type { NextFunction, Request, Response } from "express";
import { supabaseAnon } from "../config/supabase";
import { Errors } from "../lib/errors";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId: string;
    }
  }
}

// Authorization: Bearer {accessToken} 검증 (api-spec.md 공통 인증)
// Supabase Auth API에 토큰을 넘겨 검증하므로 JWT 시크릿을 서버에 별도 보관할 필요가 없다.
export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return next(Errors.unauthorized());
  }
  const token = header.slice("Bearer ".length);

  const { data, error } = await supabaseAnon.auth.getUser(token);
  if (error || !data.user) {
    return next(Errors.unauthorized());
  }

  req.userId = data.user.id;
  next();
}
