import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler";
import { getHomeSummary } from "../services/home.service";

export const homeRouter = Router();

homeRouter.get(
  "/summary",
  asyncHandler(async (req, res) => {
    const summary = await getHomeSummary(req.userId);
    res.status(200).json(summary);
  }),
);
