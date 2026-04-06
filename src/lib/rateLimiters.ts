import rateLimit from 'express-rate-limit';

/**
 * General limiter applied to all /api/v1/* routes.
 * Prevents abuse of read endpoints and limits overall request throughput per IP.
 */
export const generalLimiter = rateLimit({
  windowMs: 60 * 1000,   // 1 minute
  max: 100,              // 100 requests per minute per IP
  standardHeaders: true, // Emit RateLimit-* response headers (RFC 6585)
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Please try again later.' },
});

/**
 * Strict limiter applied only to authentication endpoints (login, register).
 * Mitigates credential stuffing and brute-force attacks on the login endpoint.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,                   // 10 attempts per 15 minutes per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many authentication attempts. Please try again in 15 minutes.',
  },
});
