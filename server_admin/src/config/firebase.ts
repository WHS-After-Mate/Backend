import fs from "node:fs";
import path from "node:path";
import { env } from "./env";

let messaging: import("firebase-admin").messaging.Messaging | null = null;

// server/src/config/firebase.ts와 동일한 지연 초기화 패턴. 이쪽은 시술 등록(addCareRecord)
// 즉시 알림 전용이라 요구되는 기능이 더 적지만, 프로세스가 분리돼 있어 설정도 각자 갖는다.
export function getMessaging() {
  if (!env.FCM_ENABLED) return null;
  if (messaging) return messaging;

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const admin = require("firebase-admin");
  const jsonPath = path.resolve(env.FIREBASE_SERVICE_ACCOUNT_JSON ?? "");
  if (!env.FIREBASE_SERVICE_ACCOUNT_JSON || !fs.existsSync(jsonPath)) {
    throw new Error(
      "FCM_ENABLED=true인데 FIREBASE_SERVICE_ACCOUNT_JSON 파일을 찾을 수 없습니다: " + jsonPath,
    );
  }
  const serviceAccount = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));

  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  }
  messaging = admin.messaging();
  return messaging;
}
