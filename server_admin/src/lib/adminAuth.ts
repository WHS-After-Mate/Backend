import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { env } from "../config/env";

const TOKEN_VALID_HOURS = 12;

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export interface AdminTokenPayload {
  adminId: string;
  username: string;
  brand: string;
}

export function issueAdminToken(payload: AdminTokenPayload) {
  return jwt.sign(payload, env.ADMIN_JWT_SECRET, { expiresIn: `${TOKEN_VALID_HOURS}h` });
}

export function verifyAdminToken(token: string): AdminTokenPayload {
  return jwt.verify(token, env.ADMIN_JWT_SECRET) as AdminTokenPayload;
}
