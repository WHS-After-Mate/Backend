import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler";
import { getMembershipById, listMemberships } from "../services/memberships.service";

// 4. My Care — 이용권 (api-spec.md §4, R-DCDOJF)

export const membershipsRouter = Router();

// 보유 이용권 목록 — 총 횟수/사용 횟수/잔여 횟수/만료일/이용 가능 관리명 포함
membershipsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const result = await listMemberships(req.userId);
    res.status(200).json(result);
  }),
);

// 이용권 상세 (목록 항목과 동일 스키마)
membershipsRouter.get(
  "/:membershipId",
  asyncHandler(async (req, res) => {
    const result = await getMembershipById(req.userId, req.params.membershipId);
    res.status(200).json(result);
  }),
);
