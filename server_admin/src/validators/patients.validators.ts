import { z } from "zod";

// 하이픈 없는 숫자만(seed.ts/emr_patients 저장 관례와 동일) 9~11자리 — 국내 유선(9~10자리)·휴대폰(10~11자리) 포괄
const phoneSchema = z.string().regex(/^\d{9,11}$/);

export const createPatientSchema = z.object({
  name: z.string().min(1),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  phone: phoneSchema,
  allergies: z.array(z.string()).default([]),
  chronicConditions: z.array(z.string()).default([]),
  doctorGeneralComment: z.string().optional(),
});

export const updatePatientSchema = z.object({
  name: z.string().min(1).optional(),
  birthDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  phone: phoneSchema.optional(),
  allergies: z.array(z.string()).optional(),
  chronicConditions: z.array(z.string()).optional(),
  doctorGeneralComment: z.string().optional(),
});

// brand는 실제 AAC 브랜드(AMRED CLINIC/DERNA CLINIC/WIM Clinic/WIM Center) 기준으로 admin-web에서
// select로 제공할 예정이라 여기선 자유 문자열로만 검증한다(신규 브랜드 추가 시 서버 배포 없이 대응 가능).
export const createCareRecordSchema = z.object({
  careName: z.string().min(1),
  // /aftercare/daily-guide가 reference_guides에서 찾는 키. 목록 밖 값도 저장은 되지만
  // claim 이후 daily-guide 조회 시 404 GUIDE_NOT_AVAILABLE로 폴백된다(server-code-guide.html 참고).
  careType: z.string().min(1),
  careDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  partOfBody: z.string().optional(),
  brand: z.string().optional(),
  store: z.string().optional(),
  practitioner: z.string().optional(),
  basicAftercareGuide: z.array(z.string()).default([]),
  doctorComment: z.string().optional(),
  sessionNumber: z.number().int().positive().optional(),
  totalSessions: z.number().int().positive().optional(),
});

export const createMembershipSchema = z.object({
  productName: z.string().min(1),
  totalCount: z.number().int().nonnegative(),
  usedCount: z.number().int().nonnegative().default(0),
  expiresAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  lastUsedAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  availableCareNames: z.array(z.string()).default([]),
});

export const listPatientsQuerySchema = z.object({
  search: z.string().optional(),
});
