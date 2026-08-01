import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { authRouter } from "./auth.routes";
import { homeRouter } from "./home.routes";
import { recommendationsRouter } from "./recommendations.routes";
import { aftercareRouter } from "./aftercare.routes";
import { careRecordsRouter } from "./careRecords.routes";
import { membershipsRouter } from "./memberships.routes";
import { profileRouter } from "./profile.routes";
import { notificationsRouter } from "./notifications.routes";

export const apiRouter = Router();

// 인증 자체는 토큰이 없는 상태로 호출되므로 requireAuth 이전에 마운트
apiRouter.use("/auth", authRouter);

// 이하 모든 라우트는 공통 인증(Authorization: Bearer) 필요 — api-spec.md 공통 규칙
apiRouter.use(requireAuth);

apiRouter.use("/home", homeRouter);
apiRouter.use("/recommendations", recommendationsRouter);
apiRouter.use("/aftercare", aftercareRouter);
apiRouter.use("/care-records", careRecordsRouter);
apiRouter.use("/memberships", membershipsRouter);
apiRouter.use("/profile", profileRouter);
apiRouter.use("/notifications", notificationsRouter);
