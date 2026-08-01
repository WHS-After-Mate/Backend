import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler";
import * as notificationsService from "../services/notifications.service";
import {
  registerDeviceTokenSchema,
  updateNotificationSettingsSchema,
} from "../validators/profile.validators";

export const notificationsRouter = Router();

notificationsRouter.get(
  "/settings",
  asyncHandler(async (req, res) => {
    const settings = await notificationsService.getNotificationSettings(req.userId);
    res.status(200).json(settings);
  }),
);

notificationsRouter.patch(
  "/settings",
  asyncHandler(async (req, res) => {
    const patch = updateNotificationSettingsSchema.parse(req.body);
    const settings = await notificationsService.updateNotificationSettings(req.userId, patch);
    res.status(200).json(settings);
  }),
);

// Android 전용 확장 — FCM 토큰 등록/해제 (api-spec.md에 신규 추가, docs/api-spec.md 참고)
notificationsRouter.post(
  "/device-token",
  asyncHandler(async (req, res) => {
    const { fcmToken, platform } = registerDeviceTokenSchema.parse(req.body);
    await notificationsService.registerDeviceToken(req.userId, fcmToken, platform);
    res.status(204).send();
  }),
);

notificationsRouter.delete(
  "/device-token",
  asyncHandler(async (req, res) => {
    const { fcmToken } = registerDeviceTokenSchema.pick({ fcmToken: true }).parse(req.body);
    await notificationsService.unregisterDeviceToken(req.userId, fcmToken);
    res.status(204).send();
  }),
);
