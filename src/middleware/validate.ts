import { Request, Response, NextFunction, RequestHandler } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { AppError } from '../utils/AppError';

type RequestTarget = 'body' | 'query' | 'params';

/**
 * Zod validation middleware factory.
 *
 * Validates and coerces req[target] against the provided Zod schema.
 * Crucially, it REPLACES req[target] with the parsed+coerced output, not the
 * raw input. This means the service layer always receives correctly-typed data
 * (e.g., query string "20" becomes the number 20, "2024-01-01" becomes a Date).
 *
 * Usage:
 *   router.post('/', validate(createRecordSchema), controller.create);
 *   router.get('/', validate(listQuerySchema, 'query'), controller.list);
 */
export function validate(schema: ZodSchema, target: RequestTarget = 'body'): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[target]);

    if (!result.success) {
      const formatted = formatZodError(result.error);
      throw new AppError('Validation failed.', 400, formatted);
    }

    // Replace raw input with parsed/coerced data
    (req as unknown as Record<string, unknown>)[target] = result.data;
    next();
  };
}

function formatZodError(error: ZodError): Record<string, string[]> {
  const formatted: Record<string, string[]> = {};

  for (const issue of error.issues) {
    const path = issue.path.join('.') || '_root';
    if (!formatted[path]) {
      formatted[path] = [];
    }
    formatted[path].push(issue.message);
  }

  return formatted;
}
