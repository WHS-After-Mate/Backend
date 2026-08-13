import { z } from "zod";

// 이름/전화번호/생년월일은 클라이언트 입력이 아니라 patientNo로 찾은 emr_patients 레코드에서 그대로 가져온다
// (의료진이 입력한 값이 원본이므로, 가입 폼에서 다시 받으면 오타/불일치가 생길 수 있어 신뢰하지 않는다).
export const signupSchema = z.object({
  patientNo: z.string().min(1),
  verificationCode: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const refreshSchema = z.object({
  refreshToken: z.string(),
});

export const passwordResetRequestSchema = z.object({
  email: z.string().email(),
});

export const passwordResetConfirmSchema = z.object({
  recoveryToken: z.string().min(1),
  newPassword: z.string().min(8),
});
