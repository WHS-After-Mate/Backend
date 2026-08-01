import { z } from "zod";

export const calendarQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, "month는 YYYY-MM 형식이어야 합니다."),
});

export const listCareRecordsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  size: z.coerce.number().int().min(1).max(100).default(20),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  partOfBody: z.string().optional(),
  brand: z.string().optional(),
});
