import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { ApiError } from "../lib/errors";

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ error: { code: "NOT_FOUND", message: `${req.method} ${req.path} 를 찾을 수 없습니다.` } });
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ApiError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message } });
    return;
  }

  if (err instanceof ZodError) {
    const message = err.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", ");
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message } });
    return;
  }

  // eslint-disable-next-line no-console
  console.error("[unhandled error]", err);
  res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } });
}
