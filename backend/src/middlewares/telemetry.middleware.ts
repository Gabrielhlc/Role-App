import type { Request, Response, NextFunction } from "express";
import { logger } from "../libs/logger.js";
import type { AuthenticatedRequest } from "./auth.middleware.js";

// Mede o tempo de resposta de cada requisição e registra status, método, rota e o ID do usuário
export function httpTelemetryMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const start = process.hrtime.bigint();

  res.on("finish", () => {
    const end = process.hrtime.bigint();
    const durationMs = Number(end - start) / 1_000_000;
    const authReq = req as AuthenticatedRequest;

    if (req.originalUrl === "/health") return;

    logger.info({
      event: "HTTP_REQUEST",
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: Number(durationMs.toFixed(2)),
      userId: authReq.user?.userId || null,
      ip: req.headers["x-forwarded-for"] || req.socket.remoteAddress,
    });
  });

  next();
}
