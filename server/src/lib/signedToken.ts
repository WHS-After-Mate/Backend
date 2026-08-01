import crypto from "node:crypto";
import { env } from "../config/env";

// 회원가입 단계 전용 단기 토큰(phoneVerifiedToken) 서명/검증.
// Supabase Auth 세션 토큰과는 별개의 자체 서명 토큰이다 — 이 시점엔 아직 계정이 없기 때문.
function base64url(input: Buffer | string) {
  return Buffer.from(input).toString("base64url");
}

export function signToken(payload: Record<string, unknown>, expiresInSeconds: number): string {
  const body = { ...payload, exp: Date.now() + expiresInSeconds * 1000 };
  const encoded = base64url(JSON.stringify(body));
  const signature = crypto.createHmac("sha256", env.APP_TOKEN_SECRET).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

export function verifyToken<T extends Record<string, unknown>>(token: string): T | null {
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;

  const expected = crypto.createHmac("sha256", env.APP_TOKEN_SECRET).update(encoded).digest("base64url");
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf-8")) as T & { exp: number };
  if (Date.now() > payload.exp) return null;
  return payload;
}
