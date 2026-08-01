import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler";
import { Errors } from "../lib/errors";
import {
  computeNextCareRecommendation,
  getNextCareRecommendationDetail,
} from "../services/recommendations.service";

export const recommendationsRouter = Router();

recommendationsRouter.get(
  "/next-care",
  asyncHandler(async (req, res) => {
    const recommendation = await computeNextCareRecommendation(req.userId);
    if (!recommendation) {
      res.status(204).send();
      return;
    }
    res.status(200).json(recommendation);
  }),
);

recommendationsRouter.get(
  "/next-care/:recommendationId",
  asyncHandler(async (req, res) => {
    const detail = await getNextCareRecommendationDetail(req.userId, req.params.recommendationId);
    if (!detail) throw Errors.notFound("추천 정보를 찾을 수 없습니다.");
    res.status(200).json(detail);
  }),
);
