import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler";
import * as catalogService from "../services/catalog.service";
import { createTreatmentSchema, listTreatmentsQuerySchema, updateTreatmentSchema } from "../validators/catalog.validators";

// 치료-부위 카탈로그 CRUD. 2026-08-19 — 시술 등록 화면에서 로그인한 클리닉과 무관한 시술까지
// 다 보이는 문제가 확인돼(treatment_catalog에 brand 컬럼 추가, treatmentCatalog 참고) 조회는
// 로그인한 클리닉 것만 보이도록 브랜드로 필터링한다. 등록/수정/삭제는 여전히 로그인만 되어
// 있으면 가능(다른 클리닉 시술을 잘못 건드리는 걸 막는 별도 검증은 아직 없음 — 필요해지면 추가).
export const catalogRouter = Router();

catalogRouter.get(
  "/treatment-catalog",
  asyncHandler(async (req, res) => {
    const { search } = listTreatmentsQuerySchema.parse(req.query);
    const treatments = await catalogService.listTreatments(req.admin!.brand, search);
    res.status(200).json({ treatments });
  }),
);

catalogRouter.post(
  "/treatment-catalog",
  asyncHandler(async (req, res) => {
    const input = createTreatmentSchema.parse(req.body);
    const treatment = await catalogService.createTreatment(input, req.admin!.brand);
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
