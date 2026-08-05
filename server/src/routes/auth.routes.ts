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
  verifyPhoneConfirmSchema,
  verifyPhoneRequestSchema,
} from "../validators/auth.validators";

// 1. 인증 / 온보딩 (api-spec.md §1) — 회원가입은 "전화번호 SMS 인증 → 이메일/비밀번호 가입" 순서로 진행

export const authRouter = Router();

// 회원가입 1단계: 본인확인용 SMS 인증코드 발송 (재요청 주기 제한 대상)
authRouter.post(
  "/signup/verify-phone/request",
  asyncHandler(async (req, res) => {
    const { phone } = verifyPhoneRequestSchema.parse(req.body);
    const result = await authService.requestPhoneVerification(phone);
    res.status(200).json(result);
  }),
);

// 회원가입 2단계: 인증코드 확인 → 성공 시 짧은 유효기간의 phoneVerifiedToken 발급 (3단계 signup에 필요)
authRouter.post(
  "/signup/verify-phone/confirm",
  asyncHandler(async (req, res) => {
    const { verificationId, code } = verifyPhoneConfirmSchema.parse(req.body);
    const result = await authService.confirmPhoneVerification(verificationId, code);
    res.status(200).json(result);
  }),
);

// 회원가입 3단계: 이메일/비밀번호 가입. phoneVerifiedToken으로 전화번호 인증 완료 여부 확인
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
