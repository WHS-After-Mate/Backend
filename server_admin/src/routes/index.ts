import { Router } from "express";
import { patientsRouter } from "./patients.routes";

// admin-web은 별도 로그인이 없는 내부용 데모 도구라(사용자 결정) requireAuth 없이 전부 열어둔다.
export const apiRouter = Router();

apiRouter.use(patientsRouter);
