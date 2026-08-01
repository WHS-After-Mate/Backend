import crypto from "node:crypto";

export function generateOtpCode(): string {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export function hashOtpCode(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex");
}

const KR_PHONE_REGEX = /^01[016789]\d{7,8}$/;

export function isValidKrPhone(phone: string): boolean {
  return KR_PHONE_REGEX.test(phone);
}
