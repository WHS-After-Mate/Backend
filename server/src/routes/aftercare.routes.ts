import { Router } from "express";
import * as aftercareService from "../services/aftercare.service";
import { asyncHandler } from "../lib/asyncHandler";
import { dailyGuideQuerySchema, submitQuestionSchema } from "../validators/aftercare.validators";

export const aftercareRouter = Router();

aftercareRouter.get(
  "/daily-guide",
  asyncHandler(async (req, res) => {
    const { careRecordId } = dailyGuideQuerySchema.parse(req.query);
    const guide = await aftercareService.getOrGenerateDailyGuide(req.userId, careRecordId);
    res.status(200).json(guide);
  }),
);

aftercareRouter.get(
  "/question-categories",
  asyncHandler(async (_req, res) => {
    res.status(200).json(aftercareService.listQuestionCategories());
  }),
);

aftercareRouter.post(
  "/questions",
  asyncHandler(async (req, res) => {
    const input = submitQuestionSchema.parse(req.body);
    const result = await aftercareService.submitQuestion(req.userId, input);
    res.status(200).json(result);
  }),
);

aftercareRouter.get(
  "/questions",
  asyncHandler(async (req, res) => {
    const result = await aftercareService.listQuestions(req.userId);
    res.status(200).json(result);
  }),
);
