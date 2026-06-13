import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/AppError';
import { logger } from '../utils/logger';

export function errorHandler(err: Error, _req: Request, res: Response, next: NextFunction): void {
  // If the response has already started, hand off to Express's default handler.
  if (res.headersSent) {
    next(err);
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({ error: { message: 'Validation failed', details: err.issues } });
    return;
  }

  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error({ err }, 'Server error');
    }
    res.status(err.statusCode).json({ error: { message: err.message } });
    return;
  }

  // http-errors thrown by middleware (e.g. body-parser): malformed JSON → 400,
  // payload too large → 413. Honour their 4xx status instead of masking it as 500.
  const httpStatus =
    (err as { status?: number; statusCode?: number }).status ??
    (err as { statusCode?: number }).statusCode;
  if (typeof httpStatus === 'number' && httpStatus >= 400 && httpStatus < 500) {
    res.status(httpStatus).json({ error: { message: err.message } });
    return;
  }

  logger.error({ err }, 'Unhandled error');
  res.status(500).json({ error: { message: 'Internal Server Error' } });
}
