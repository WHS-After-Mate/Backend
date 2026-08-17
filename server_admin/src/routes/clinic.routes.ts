import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler";
import * as clinicService from "../services/clinic.service";

// 로그인한 클리닉의 공개 정보(카카오톡/전화번호) + 담당 의료진 목록. routes/index.ts에서
// requireAdminAuth 뒤에 걸려있어 req.admin이 항상 채워져 있다. brand로만 조회하므로 다른
// 클리닉 정보는 응답에 절대 섞이지 않는다.
export const clinicRouter = Router();

clinicRouter.get(
  "/clinic-info",
  asyncHandler(async (req, res) => {
    const info = await clinicService.getClinicInfo(req.admin!.brand);
    res.status(200).json(info);
  }),
);
