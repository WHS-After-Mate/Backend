import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler";
import { Errors } from "../lib/errors";
import * as authService from "../services/auth.service";
import {
  loginSchema,
  passwordResetConfirmSchema,
  passwordResetRequestSchema,
  passwordResetVerifySchema,
  refreshSchema,
  signupSchema,
} from "../validators/auth.validators";

// 1. 인증 / 온보딩 (api-spec.md §1)
// 회원가입은 병원(admin-web/server_admin)에서 발급한 환자번호와, 그 환자번호에 등록된 이름·생년월일이
// 모두 일치해야만 가능하다 — 환자번호 없는 자유 가입은 막혀있다(실제 시술 이력 없는 계정 방지).

export const authRouter = Router();

// 회원가입: 환자번호+이름+생년월일 일치 확인으로 emr_patients를 claim하며 이메일/비밀번호 계정 생성
authRouter.post(
  "/signup",
  asyncHandler(async (req, res) => {
    const input = signupSchema.parse(req.body);
    const result = await authService.signup(input);
    res.status(200).json(result);
  }),
);

// 실제 계정 로그인(이메일/비밀번호) — accessToken/refreshToken 발급
authRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const input = loginSchema.parse(req.body);
    const result = await authService.login(input);
    res.status(200).json(result);
  }),
);

// accessToken 만료 시 refreshToken으로 재발급
authRouter.post(
  "/refresh",
  asyncHandler(async (req, res) => {
    const { refreshToken } = refreshSchema.parse(req.body);
    const result = await authService.refreshAccessToken(refreshToken);
    res.status(200).json(result);
  }),
);

// 설정 화면의 로그아웃 액션 — 서버 측 refreshToken 무효화
authRouter.post(
  "/logout",
  asyncHandler(async (req, res) => {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) throw Errors.unauthorized();
    await authService.logout(header.slice("Bearer ".length));
    res.status(204).send();
  }),
);

// 로그인 화면 "비밀번호를 잊으셨나요?" — 이메일 입력 시 재설정 인증코드 발송
authRouter.post(
  "/password/reset-request",
  asyncHandler(async (req, res) => {
    const { email } = passwordResetRequestSchema.parse(req.body);
    await authService.requestPasswordReset(email);
    res.status(204).send();
  }),
);

// 이메일로 받은 인증코드만 먼저 확인 (와이어프레임 05번의 "인증번호 확인" 버튼) — 성공 시 다음
// 단계(reset-confirm)에서 쓸 resetToken 발급. 코드 자체는 이 호출로 소진되므로 재사용 불가.
authRouter.post(
  "/password/reset-verify",
  asyncHandler(async (req, res) => {
    const { email, code } = passwordResetVerifySchema.parse(req.body);
    const resetToken = await authService.verifyPasswordResetCode(email, code);
    res.status(200).json({ resetToken });
  }),
);

// reset-verify에서 받은 resetToken + 새 비밀번호 제출
authRouter.post(
  "/password/reset-confirm",
  asyncHandler(async (req, res) => {
    const { resetToken, newPassword } = passwordResetConfirmSchema.parse(req.body);
    await authService.confirmPasswordReset(resetToken, newPassword);
    res.status(204).send();
  }),
);
