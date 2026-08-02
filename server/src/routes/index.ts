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

// Router()는 express()와 달리 listen()이 없는 "부착 가능한 라우트 묶음"이다.
// 이 apiRouter 자체도, 아래에서 조립하는 authRouter/homeRouter 등도 전부 Router() 인스턴스이며,
// app.ts의 app.use("/api/v1", apiRouter)를 통해 최종적으로 진짜 app 본체에 연결된다.
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
