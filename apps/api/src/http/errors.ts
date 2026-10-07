import type { ErrorRequestHandler, RequestHandler } from "express";
import { ERROR_MESSAGES, type ErrorCode } from "@trial/shared";
import { ZodError } from "zod";

export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    public status: number,
    message?: string,
    public details?: unknown
  ) {
    super(message ?? ERROR_MESSAGES[code]);
  }
}

export const notFound = (message?: string) => new AppError("NOT_FOUND", 404, message);

export function zodToAppError(err: ZodError): AppError {
  const fieldErrors: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.join(".") || "_";
    if (!fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return new AppError("VALIDATION", 422, ERROR_MESSAGES.VALIDATION, { fieldErrors });
}

export const notFoundHandler: RequestHandler = () => {
  throw notFound();
};

export function errorHandler(log: (err: unknown) => void): ErrorRequestHandler {
  return (err, _req, res, _next) => {
    let e: AppError;
    if (err instanceof AppError) e = err;
    else if (err instanceof ZodError) e = zodToAppError(err);
    else if (err?.type === "entity.parse.failed") e = new AppError("VALIDATION", 400, "The request body isn't valid JSON.");
    else {
      log(err);
      e = new AppError("INTERNAL", 500);
    }
    const body: { error: { code: string; message: string; details?: unknown } } = { error: { code: e.code, message: e.message } };
    if (e.details !== undefined) body.error.details = e.details;
    res.status(e.status).json(body);
  };
}
