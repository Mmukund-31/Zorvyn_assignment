import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../lib/jwt';
import { prisma } from '../lib/prisma';
import { AppError } from '../utils/AppError';
import { asyncHandler } from '../utils/asyncHandler';

/**
 * JWT authentication middleware.
 *
 * Design decision: After verifying the JWT signature, we perform a database
 * lookup to confirm the user is still active. This is intentionally slower
 * than pure stateless JWT validation, but it ensures that if an admin
 * deactivates or deletes an account, the user loses access immediately rather
 * than continuing until the token expires. For a finance system where revoking
 * access quickly matters, this tradeoff is correct.
 */
export const authenticate = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      throw new AppError('Authentication token is required.', 401);
    }

    const token = authHeader.slice(7);
    const payload = verifyToken(token); // throws JsonWebTokenError / TokenExpiredError

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user) {
      throw new AppError('User not found.', 401);
    }

    if (!user.isActive) {
      throw new AppError('Your account has been deactivated. Contact an administrator.', 401);
    }

    if (user.deletedAt !== null) {
      throw new AppError('This account no longer exists.', 401);
    }

    req.user = user;
    next();
  }
);
