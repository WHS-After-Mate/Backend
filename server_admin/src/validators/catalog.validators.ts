import { z } from "zod";
import { BODY_PARTS } from "../lib/bodyParts";

export const createTreatmentSchema = z.object({
  careName: z.string().min(1),
  careType: z.string().min(1),
  bodyParts: z.array(z.enum(BODY_PARTS)).min(1),
});

export const updateTreatmentSchema = z.object({
  careName: z.string().min(1).optional(),
  careType: z.string().min(1).optional(),
  bodyParts: z.array(z.enum(BODY_PARTS)).min(1).optional(),
});

export const listTreatmentsQuerySchema = z.object({
  search: z.string().optional(),
});
