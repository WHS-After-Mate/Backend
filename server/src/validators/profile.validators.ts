import { z } from "zod";

export const updateProfileSchema = z.object({
  name: z.string().min(1).optional(),
});

export const updateInterestsSchema = z.object({
  goals: z.array(z.string().min(1)),
});

export const updateNotificationSettingsSchema = z.object({
  pushEnabled: z.boolean().optional(),
  aftercareReminder: z.boolean().optional(),
  membershipExpiryAlert: z.boolean().optional(),
});

export const registerDeviceTokenSchema = z.object({
  fcmToken: z.string().min(1),
  platform: z.literal("android").default("android"),
});
