import { Router } from "express";
import { requireAdminAuth } from "../middleware/requireAdminAuth";
import { adminAuthRouter } from "./adminAuth.routes";
import { catalogRouter } from "./catalog.routes";
import { patientsRouter } from "./patients.routes";

// 클리닉 관리자 로그인 계정이 추가됨(admin_accounts, migration 008) — 기존 "무인증 데모" 결정을 뒤집는
// 변경. /auth/login만 공개하고 나머지 전부(환자/시술기록/이용권/care-types/treatment-catalog)는 로그인
// 토큰이 있어야 통과한다. 환자 등록/조회의 brand 자동 채움·클리닉별 데이터 격리까지 patients.routes.ts에
// 적용됨(treatment-catalog는 클리닉 공통 자료라 격리 대상 아님 — catalog.routes.ts 참고).
export const apiRouter = Router();

apiRouter.use(adminAuthRouter);
apiRouter.use(requireAdminAuth);
apiRouter.use(patientsRouter);
apiRouter.use(catalogRouter);
