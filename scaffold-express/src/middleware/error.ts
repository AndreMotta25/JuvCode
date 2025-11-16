import type { Request, Response, NextFunction } from "express";
import logger from "../lib/logger";

export function notFound(req: Request, res: Response, next: NextFunction) {
  const err = new Error("Not Found");
  (err as any).status = 404;
  next(err);
}

export function errorHandler(
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  const status = err.status || 500;
  const message = err.message || "Internal Server Error";
  logger.error(message, { status, stack: err?.stack });
  res.status(status).json({ error: message });
}