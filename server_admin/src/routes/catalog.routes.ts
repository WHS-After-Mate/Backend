import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler";
import * as catalogService from "../services/catalog.service";
import { createTreatmentSchema, listTreatmentsQuerySchema, updateTreatmentSchema } from "../validators/catalog.validators";

// 치료-부위 카탈로그 CRUD — 클리닉 공통 자료라 brand 격리 대상 아님(로그인만 되어 있으면 어느
// 클리닉 계정이든 조회/수정 가능). routes/index.ts에서 requireAdminAuth 뒤에 걸려있다.
export const catalogRouter = Router();

catalogRouter.get(
  "/treatment-catalog",
  asyncHandler(async (req, res) => {
    const { search } = listTreatmentsQuerySchema.parse(req.query);
    const treatments = await catalogService.listTreatments(search);
    res.status(200).json({ treatments });
  }),
);

catalogRouter.post(
  "/treatment-catalog",
  asyncHandler(async (req, res) => {
    const input = createTreatmentSchema.parse(req.body);
    const treatment = await catalogService.createTreatment(input);
    res.status(201).json(treatment);
  }),
);

catalogRouter.patch(
  "/treatment-catalog/:treatmentId",
  asyncHandler(async (req, res) => {
    const input = updateTreatmentSchema.parse(req.body);
    const treatment = await catalogService.updateTreatment(req.params.treatmentId, input);
    res.status(200).json(treatment);
  }),
);

catalogRouter.delete(
  "/treatment-catalog/:treatmentId",
  asyncHandler(async (req, res) => {
    await catalogService.deleteTreatment(req.params.treatmentId);
    res.status(204).send();
  }),
);
