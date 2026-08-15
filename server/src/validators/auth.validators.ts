import { z } from "zod";

// 인증코드 발송을 없애고, patientNo + name + birthDate 조합으로 신원을 확인한다 — 셋 다
// emr_patients에 등록된 값과 정확히 일치해야 가입이 진행된다(전화번호는 신원확인에 안 씀).
// phone은 여전히 client 입력이 아니라 patientNo로 찾은 emr_patients 레코드에서 그대로 가져온다.
export const signupSchema = z.object({
  patientNo: z.string().min(1),
  name: z.string().min(1),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
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
