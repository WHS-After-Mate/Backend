import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler";
import {
  getCalendarSummary,
  getCareRecordById,
  listCareRecords,
} from "../services/careRecords.service";
import { calendarQuerySchema, listCareRecordsQuerySchema } from "../validators/careRecords.validators";

export const careRecordsRouter = Router();

careRecordsRouter.get(
  "/calendar",
  asyncHandler(async (req, res) => {
    const { month } = calendarQuerySchema.parse(req.query);
    const result = await getCalendarSummary(req.userId, month);
    res.status(200).json(result);
  }),
);

careRecordsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const query = listCareRecordsQuerySchema.parse(req.query);
    const result = await listCareRecords(req.userId, query);
    res.status(200).json(result);
  }),
);

careRecordsRouter.get(
  "/:careRecordId",
  asyncHandler(async (req, res) => {
    const record = await getCareRecordById(req.userId, req.params.careRecordId);
    res.status(200).json({
      careRecordId: record.id,
      careName: record.care_name,
      careDate: record.care_date,
      partOfBody: record.part_of_body,
      brand: record.brand,
      store: record.store,
      practitioner: record.practitioner,
      basicAftercareGuide: record.basic_aftercare_guide,
    });
  }),
);
