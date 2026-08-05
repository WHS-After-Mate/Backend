import { z } from "zod";

export const dailyGuideQuerySchema = z.object({
  careRecordId: z.string().uuid().optional(),
  // AI 사후관리 가이드 화면의 1/3/5/7/10일차 탭 선택값 (v0.5). 생략 시 오늘 실제 경과일 기준
  elapsedDay: z.coerce.number().int().min(0).optional(),
});

export const submitQuestionSchema = z.object({
  careRecordId: z.string().uuid().optional(),
  category: z.string().min(1),
  question: z.string().min(1).max(1000),
});
