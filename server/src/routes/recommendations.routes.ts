import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler";
import { Errors } from "../lib/errors";
import {
  computeNextCareRecommendation,
  getNextCareRecommendationDetail,
} from "../services/recommendations.service";

// 2. 홈 — 다음 관리 추천 (api-spec.md §2, R-QGENNK)
// 추천 대상 시술 선정(카탈로그 매칭)은 규칙 기반(관심 목표 + 최근 관리 연관성)이지만,
// 추천 사유(reasons)/상세 설명(detailDescription) 문구는 2026-08-18부터 OpenAI로 생성한다
// (dd.txt 요청 — 시술마다 다른 문구가 나와야 함). OPENAI_API_KEY 미설정/호출 실패 시 정적 템플릿 문구로 폴백.

export const recommendationsRouter = Router();

// 규칙 기반 추천 후보 1개 + 이유. 홈은 이 엔드포인트를 직접 호출하지 않고
// GET /home/summary의 recommendation 필드를 재사용 — 새로고침/홈 API 실패 시 폴백용으로 별도 제공
// 204: 추천 근거 부족(관리 이력 없음 등)
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

// 추천 카드 클릭 → 추천 상세 보기 (detailDescription 포함)
recommendationsRouter.get(
  "/next-care/:recommendationId",
  asyncHandler(async (req, res) => {
    const detail = await getNextCareRecommendationDetail(req.userId, req.params.recommendationId);
    if (!detail) throw Errors.notFound("추천 정보를 찾을 수 없습니다.");
    res.status(200).json(detail);
  }),
);
