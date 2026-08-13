import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler";
import { Errors } from "../lib/errors";
import * as authService from "../services/auth.service";
import {
  loginSchema,
  passwordResetConfirmSchema,
  passwordResetRequestSchema,
  refreshSchema,
  signupSchema,
} from "../validators/auth.validators";

// 1. 인증 / 온보딩 (api-spec.md §1)
// 회원가입은 병원(admin-web/server_admin)에서 발급한 환자번호+인증코드로만 가능하다 —
// 환자번호 없는 자유 가입은 막혀있다(실제 시술 이력 없는 계정이 생기는 것을 방지).

export const authRouter = Router();

// 회원가입: 환자번호 + 인증코드로 emr_patients를 claim하며 이메일/비밀번호 계정 생성
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

// 로그인 화면 "비밀번호를 잊으셨나요?" — 이메일 입력 시 재설정 링크 발송 (v0.5)
authRouter.post(
  "/password/reset-request",
  asyncHandler(async (req, res) => {
    const { email } = passwordResetRequestSchema.parse(req.body);
    await authService.requestPasswordReset(email);
    res.status(204).send();
  }),
);

// 재설정 링크로 열린 화면에서 새 비밀번호 설정 (v0.5)
authRouter.post(
  "/password/reset-confirm",
  asyncHandler(async (req, res) => {
    const { recoveryToken, newPassword } = passwordResetConfirmSchema.parse(req.body);
    await authService.confirmPasswordReset(recoveryToken, newPassword);
    res.status(204).send();
  }),
);
