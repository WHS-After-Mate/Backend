import { z } from "zod";

export const dailyGuideQuerySchema = z.object({
  careRecordId: z.string().uuid().optional(),
});

export const submitQuestionSchema = z.object({
  careRecordId: z.string().uuid().optional(),
  category: z.string().min(1),
  question: z.string().min(1).max(1000),
});
