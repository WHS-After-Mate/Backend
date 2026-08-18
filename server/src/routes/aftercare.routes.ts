import { Router } from "express";
import * as aftercareService from "../services/aftercare.service";
import { asyncHandler } from "../lib/asyncHandler";
import { dailyGuideQuerySchema, submitQuestionSchema } from "../validators/aftercare.validators";

// 3. 사후관리 안내 및 Q&A — LLM 기반 (api-spec.md §3, R-USXPEM → F-GBZTGO, F-ULCIXA)
// 최근 관리명·관리일·경과일·환자 정보를 컨텍스트로 LLM(OpenAI)이 직접 종합해 생성한다
// (2026-08-19 docs/prompt.docx 설계로 전환 — reference_guides 원문을 그대로 재서술하던 이전 방식과
// 달리, 시술/환자 정보를 근거로 LLM이 판단한다. reference_guides는 LLM 실패 시 폴백 용도로만 남음).
// 의료적 진단/처방은 생성하지 않도록 시스템 프롬프트에서 제한 (server/src/services/aftercare.service.ts 참고)

export const aftercareRouter = Router();

// F-GBZTGO: 경과일에 맞는 일차별 주의사항. "관리 건 + 오늘 날짜" 조합 기준 1일 1회 LLM 호출로 생성 후
// 자정까지 캐시. LLM 실패 시 503 대신 검수 가이드(reference_guides) 원문으로 자동 폴백(200, generatedBy: "reference_guide")
aftercareRouter.get(
  "/daily-guide",
  asyncHandler(async (req, res) => {
    const { careRecordId, elapsedDay } = dailyGuideQuerySchema.parse(req.query);
    const guide = await aftercareService.getOrGenerateDailyGuide(req.userId, careRecordId, elapsedDay);
    res.status(200).json(guide);
  }),
);

// 챗봇 진입 시 최초 호출되는 지원 질문 카테고리 고정값 목록 (LLM 미사용)
aftercareRouter.get(
  "/question-categories",
  asyncHandler(async (_req, res) => {
    res.status(200).json(aftercareService.listQuestionCategories());
  }),
);

// F-ULCIXA: 챗봇 질문 등록 및 LLM 답변 조회(동기 응답). 카테고리 검증·위험신호 키워드는
// 규칙 기반으로 LLM 호출 전에 우선 차단(status: expert_required), 근거 부족 시 out_of_scope로 응답
aftercareRouter.post(
  "/questions",
  asyncHandler(async (req, res) => {
    const input = submitQuestionSchema.parse(req.body);
    const result = await aftercareService.submitQuestion(req.userId, input);
    res.status(200).json(result);
  }),
);

// 내 질문 이력 조회(최신순) — 현재 유저플로우에는 명시적 진입점 없음(향후 "지난 질문 보기" 등 연결 예정)
aftercareRouter.get(
  "/questions",
  asyncHandler(async (req, res) => {
    const result = await aftercareService.listQuestions(req.userId);
    res.status(200).json(result);
  }),
);
