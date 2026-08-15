import type { NextFunction, Request, Response } from "express";
import { verifyAdminToken, type AdminTokenPayload } from "../lib/adminAuth";
import { Errors } from "../lib/errors";

declare global {
  namespace Express {
    interface Request {
      admin?: AdminTokenPayload;
    }
  }
}

// /auth/login을 뺀 나머지 admin API 전부를 로그인 필수로 막는다. 토큰의 brand가
// 이후 시술기록 추가 시 자동 채움·클리닉별 데이터 격리의 근거가 된다.
export function requireAdminAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : undefined;
  if (!token) throw Errors.unauthorized();

  try {
    req.admin = verifyAdminToken(token);
  } catch {
    throw Errors.unauthorized();
  }

  next();
}
