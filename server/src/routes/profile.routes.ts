import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler";
import * as profileService from "../services/profile.service";
import {
  changePasswordSchema,
  updateInterestsSchema,
  updateProfileSchema,
} from "../validators/profile.validators";

// 5. 설정 / 프로필 (api-spec.md §5)

export const profileRouter = Router();

// 프로필 조회 (이름, 이메일, 관심 목표)
profileRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const profile = await profileService.getProfile(req.userId);
    res.status(200).json(profile);
  }),
);

// 이름 등 기본 정보 수정 — 유저플로우엔 아직 명시적 편집 버튼 액션 노드 없음(추가 예정)
profileRouter.patch(
  "/",
  asyncHandler(async (req, res) => {
    const patch = updateProfileSchema.parse(req.body);
    const profile = await profileService.updateProfile(req.userId, patch);
    res.status(200).json(profile);
  }),
);

// 내 정보 화면의 비밀번호 변경 — 현재 비밀번호 확인 후 저장 (v0.5)
profileRouter.post(
  "/password",
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
    await profileService.changePassword(req.userId, currentPassword, newPassword);
    res.status(204).send();
  }),
);

// 관심 목표 설정 — 다음 관리 추천(recommendations, basis: "goal")의 입력값으로 사용됨
profileRouter.put(
  "/interests",
  asyncHandler(async (req, res) => {
    const { goals } = updateInterestsSchema.parse(req.body);
    const result = await profileService.updateInterestGoals(req.userId, goals);
    res.status(200).json(result);
  }),
);
