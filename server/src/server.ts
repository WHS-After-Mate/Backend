import { app } from "./app";
import { env } from "./config/env";
import { startNotificationScheduler } from "./services/notificationScheduler.service";

app.listen(env.PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`WHS After Mate API listening on :${env.PORT} (${env.NODE_ENV})`);
});

if (env.FCM_ENABLED) startNotificationScheduler();
