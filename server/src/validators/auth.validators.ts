import { z } from "zod";

export const verifyPhoneRequestSchema = z.object({
  phone: z.string(),
});

export const verifyPhoneConfirmSchema = z.object({
  verificationId: z.string().uuid(),
  code: z.string().length(6),
});

export const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
  phone: z.string(),
  phoneVerifiedToken: z.string(),
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
