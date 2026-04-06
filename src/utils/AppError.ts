/**
 * Custom application error class.
 *
 * isOperational distinguishes expected business errors (validation failures,
 * not-found errors, permission denials) from unexpected programmer errors
 * (null dereferences, type errors). The global error handler logs stack
 * traces only for non-operational errors.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly details?: unknown;

  constructor(
    message: string,
    statusCode: number,
    details?: unknown,
    isOperational = true
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}
