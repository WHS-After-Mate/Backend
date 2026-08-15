import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler";
import * as adminAuthService from "../services/adminAuth.service";
import { adminLoginSchema } from "../validators/adminAuth.validators";

export const adminAuthRouter = Router();

// 클리닉 관리자 로그인 — 성공 시 토큰과 함께 brand를 내려준다.
// admin-web은 이후 환자 등록·시술기록 추가 시 이 brand를 그대로 써서 클리닉을 수동 선택하지 않게 한다.
adminAuthRouter.post(
  "/auth/login",
  asyncHandler(async (req, res) => {
    const input = adminLoginSchema.parse(req.body);
    const result = await adminAuthService.login(input.username, input.password);
    res.status(200).json(result);
  }),
);
