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
  // 와이어프레임 원안: 회원가입 화면에서 관심 목표를 중복 선택 — 다음 관리 추천의 우선순위에 반영되고
  // 내 정보 > 관심 목표 화면에서 동일한 값이 보이며 그 화면에서 나중에 바꿀 수도 있다.
  interestGoals: z.array(z.string().min(1)).default([]),
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

export const passwordResetVerifySchema = z.object({
  email: z.string().email(),
  // Supabase 대시보드 설정에 따라 OTP 자리수가 달라질 수 있어(이 프로젝트는 실측 결과 8자리) 정확한
  // 자리수로 고정하지 않고 숫자로만 구성됐는지만 느슨하게 검증한다.
  code: z.string().regex(/^\d{6,10}$/, "6~10자리 숫자"),
});

export const passwordResetConfirmSchema = z.object({
  // reset-verify 응답으로 받은 값을 그대로 넘긴다 — 여기서 email/code를 다시 받지 않는다.
  resetToken: z.string().min(1),
  newPassword: z.string().min(8),
});
