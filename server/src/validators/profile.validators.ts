import { z } from "zod";

export const updateProfileSchema = z.object({
  name: z.string().min(1).optional(),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const updateInterestsSchema = z.object({
  goals: z.array(z.string().min(1)),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

export const registerDeviceTokenSchema = z.object({
  fcmToken: z.string().min(1),
  platform: z.literal("android").default("android"),
});

export const updateNotificationSettingsSchema = z
  .object({
    careNotification: z.boolean().optional(),
    marketingNotification: z.boolean().optional(),
  })
  .refine((v) => v.careNotification !== undefined || v.marketingNotification !== undefined, {
    message: "careNotification 또는 marketingNotification 중 최소 하나는 필요합니다.",
  });
