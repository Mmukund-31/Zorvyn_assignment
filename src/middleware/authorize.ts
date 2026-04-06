import { Request, Response, NextFunction, RequestHandler } from 'express';
import { Role } from '@prisma/client';
import { AppError } from '../utils/AppError';

/**
 * RBAC authorization middleware factory.
 *
 * Uses an explicit allowlist of permitted roles rather than a hierarchy check.
 * This is intentional: if a non-hierarchical role (e.g. AUDITOR) is added
 * later, allowlists still work correctly without refactoring.
 *
 * Must be used after authenticate() so that req.user is populated.
 *
 * Usage:
 *   router.get('/', authorize([Role.ADMIN]), controller.list);
 *   router.post('/', authorize([Role.ADMIN, Role.ANALYST]), controller.create);
 */
export function authorize(allowedRoles: Role[]): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new AppError('Not authenticated.', 401);
    }

    if (!allowedRoles.includes(req.user.role)) {
      throw new AppError(
        `Access denied. Required role: ${allowedRoles.join(' or ')}.`,
        403
      );
    }

    next();
  };
}
