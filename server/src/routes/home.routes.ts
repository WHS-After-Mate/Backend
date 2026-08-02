import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler";
import { getHomeSummary } from "../services/home.service";

// 2. 홈 (api-spec.md §2, R-USXPEM, R-QGENNK)

export const homeRouter = Router();

// 홈 진입 시 1회 호출 — 최근 관리 요약, 경과일 주의사항 카드(사후관리 카드),
// 이용권 요약, 다음 관리 추천을 한 번에 반환. 홈은 이 응답의 recommendation 필드를
// 재사용하고 별도로 GET /recommendations/next-care를 호출하지 않는다
homeRouter.get(
  "/summary",
  asyncHandler(async (req, res) => {
    const summary = await getHomeSummary(req.userId);
    res.status(200).json(summary);
  }),
);
