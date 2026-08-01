import fs from "node:fs";
import path from "node:path";
import { env } from "./env";

let messaging: import("firebase-admin").messaging.Messaging | null = null;

// FCM은 서비스 계정 JSON을 아직 발급받지 못한 해커톤 초기 단계에도 서버가 뜰 수 있도록
// FCM_ENABLED=false면 완전히 건너뛴다. 디바이스 토큰 등록 API 자체는 FCM 설정과 무관하게 동작.
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
