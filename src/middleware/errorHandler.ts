import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { AppError } from '../utils/AppError';
import { config } from '../config';

/**
 * Global error handler. Must be registered as the LAST middleware in app.ts.
 *
 * Translates AppError instances, Prisma errors, and JWT errors into consistent
 * JSON responses. Non-operational (programmer) errors are logged with a stack
 * trace and return a generic 500 message to avoid leaking internals.
 *
 * All error responses use the same envelope:
 * { success: false, message: string, errors?: unknown }
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  // --- AppError (our own operational errors) ---
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      errors: err.details ?? null,
    });
    return;
  }

  // --- Prisma known request errors ---
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      // Unique constraint violation
      res.status(409).json({
        success: false,
        message: 'A record with this value already exists.',
        errors: { field: err.meta?.target },
      });
      return;
    }

    if (err.code === 'P2025') {
      // Record not found (e.g. update/delete on non-existent id)
      res.status(404).json({
        success: false,
        message: 'The requested record was not found.',
        errors: null,
      });
      return;
    }

    if (err.code === 'P2003') {
      // Foreign key constraint violation
      res.status(400).json({
        success: false,
        message: 'Invalid reference: a related record does not exist.',
        errors: null,
      });
      return;
    }
  }

  // --- JWT errors ---
  if (err instanceof Error) {
    if (err.name === 'JsonWebTokenError') {
      res.status(401).json({ success: false, message: 'Invalid token.', errors: null });
      return;
    }
    if (err.name === 'TokenExpiredError') {
      res.status(401).json({ success: false, message: 'Token has expired.', errors: null });
      return;
    }
  }

  // --- Unknown / programmer errors ---
  // Log stack trace in development; never expose internals to clients
  if (config.isDev) {
    console.error('[Unhandled Error]', err);
  } else {
    console.error('[Unhandled Error]', err instanceof Error ? err.message : String(err));
  }

  res.status(500).json({
    success: false,
    message: 'An unexpected error occurred. Please try again later.',
    errors: null,
  });
}
