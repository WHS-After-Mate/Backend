import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler";
import * as profileService from "../services/profile.service";
import { updateInterestsSchema, updateProfileSchema } from "../validators/profile.validators";

export const profileRouter = Router();

profileRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const profile = await profileService.getProfile(req.userId);
    res.status(200).json(profile);
  }),
);

profileRouter.patch(
  "/",
  asyncHandler(async (req, res) => {
    const patch = updateProfileSchema.parse(req.body);
    const profile = await profileService.updateProfile(req.userId, patch);
    res.status(200).json(profile);
  }),
);

profileRouter.put(
  "/interests",
  asyncHandler(async (req, res) => {
    const { goals } = updateInterestsSchema.parse(req.body);
    const result = await profileService.updateInterestGoals(req.userId, goals);
    res.status(200).json(result);
  }),
);
