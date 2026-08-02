import cors from "cors";
import express from "express";
import { env } from "./config/env";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { apiRouter } from "./routes";

// express()는 앱 전체를 대표하는 "본체" 객체를 만든다 — 프로젝트에서 단 한 번만 호출.
// Router()(routes/*.ts)와 달리 이 app만 app.listen()으로 실제 포트를 열어 서버를 가동할 수 있다.
export const app = express();

app.use(cors({ origin: env.CORS_ORIGIN }));
app.use(express.json());

app.get("/health", (_req, res) => res.status(200).json({ status: "ok" }));

app.use("/api/v1", apiRouter);

app.use(notFoundHandler);
app.use(errorHandler);
