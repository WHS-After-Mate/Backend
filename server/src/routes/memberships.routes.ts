import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler";
import { getMembershipById, listMemberships } from "../services/memberships.service";

export const membershipsRouter = Router();

membershipsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const result = await listMemberships(req.userId);
    res.status(200).json(result);
  }),
);

membershipsRouter.get(
  "/:membershipId",
  asyncHandler(async (req, res) => {
    const result = await getMembershipById(req.userId, req.params.membershipId);
    res.status(200).json(result);
  }),
);
