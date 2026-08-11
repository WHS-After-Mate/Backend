import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler";
import * as notificationsService from "../services/notifications.service";
import { registerDeviceTokenSchema } from "../validators/profile.validators";

// 5. 설정 / 프로필 — 알림 (api-spec.md §5)

export const notificationsRouter = Router();

// Android 전용 확장 — FCM(Firebase Cloud Messaging) 토큰 등록. 앱 시작 시 또는
// 토큰 갱신(onNewToken) 시 호출. 구현 중 api-spec.md §5에 신규 추가된 엔드포인트
notificationsRouter.post(
  "/device-token",
  asyncHandler(async (req, res) => {
    const { fcmToken, platform } = registerDeviceTokenSchema.parse(req.body);
    await notificationsService.registerDeviceToken(req.userId, fcmToken, platform);
    res.status(204).send();
  }),
);

// 로그아웃 등으로 더 이상 해당 기기에 푸시를 보내지 않아야 할 때 FCM 토큰 해제
notificationsRouter.delete(
  "/device-token",
  asyncHandler(async (req, res) => {
    const { fcmToken } = registerDeviceTokenSchema.pick({ fcmToken: true }).parse(req.body);
    await notificationsService.unregisterDeviceToken(req.userId, fcmToken);
    res.status(204).send();
  }),
);
