import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler";
import { Errors } from "../lib/errors";
import * as authService from "../services/auth.service";
import {
  loginSchema,
  refreshSchema,
  signupSchema,
  verifyPhoneConfirmSchema,
  verifyPhoneRequestSchema,
} from "../validators/auth.validators";

export const authRouter = Router();

authRouter.post(
  "/signup/verify-phone/request",
  asyncHandler(async (req, res) => {
    const { phone } = verifyPhoneRequestSchema.parse(req.body);
    const result = await authService.requestPhoneVerification(phone);
    res.status(200).json(result);
  }),
);

authRouter.post(
  "/signup/verify-phone/confirm",
  asyncHandler(async (req, res) => {
    const { verificationId, code } = verifyPhoneConfirmSchema.parse(req.body);
    const result = await authService.confirmPhoneVerification(verificationId, code);
    res.status(200).json(result);
  }),
);

authRouter.post(
  "/signup",
  asyncHandler(async (req, res) => {
    const input = signupSchema.parse(req.body);
    const result = await authService.signup(input);
    res.status(200).json(result);
  }),
);

authRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const input = loginSchema.parse(req.body);
    const result = await authService.login(input);
    res.status(200).json(result);
  }),
);

authRouter.post(
  "/refresh",
  asyncHandler(async (req, res) => {
    const { refreshToken } = refreshSchema.parse(req.body);
    const result = await authService.refreshAccessToken(refreshToken);
    res.status(200).json(result);
  }),
);

authRouter.post(
  "/logout",
  asyncHandler(async (req, res) => {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) throw Errors.unauthorized();
    await authService.logout(header.slice("Bearer ".length));
    res.status(204).send();
  }),
);
