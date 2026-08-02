import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler";
import {
  getCalendarSummary,
  getCareRecordById,
  listCareRecords,
} from "../services/careRecords.service";
import { calendarQuerySchema, listCareRecordsQuerySchema } from "../validators/careRecords.validators";

// 4. My Care — 관리 이력 및 이용권 (api-spec.md §4, R-DCDOJF)
// 캘린더 / 이력 / 이용권 3개 진입점이 모두 동일한 GET /care-records/{id} 상세 화면으로 연결됨

export const careRecordsRouter = Router();

// 캘린더 화면에 월별 시술 유무·건수 마커를 표시하기 위한 요약 조회 (월 단위 집계)
careRecordsRouter.get(
  "/calendar",
  asyncHandler(async (req, res) => {
    const { month } = calendarQuerySchema.parse(req.query);
    const result = await getCalendarSummary(req.userId, month);
    res.status(200).json(result);
  }),
);

// 관리 이력 목록(최신순) — 이력 탭 전체 목록, 캘린더 날짜 클릭 시 목록(dateFrom=dateTo),
// 이력 필터(dateFrom/dateTo/partOfBody/brand)까지 이 하나의 엔드포인트를 재사용
careRecordsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const query = listCareRecordsQuerySchema.parse(req.query);
    const result = await listCareRecords(req.userId, query);
    res.status(200).json(result);
  }),
);

// 관리 상세 + 기본 사후관리 안내. 상세 화면의 "AI 사후관리 가이드" 버튼은
// GET /aftercare/daily-guide?careRecordId={id}로 이동(3절 LLM 가이드와 연결)
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
