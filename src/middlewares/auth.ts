import { RequestHandler } from 'express';
import { AppError } from '../utils/AppError';
import { Role } from '../types/auth';
import { TokenVerifier } from '../services/auth/tokenVerifier';

const BEARER_PREFIX = 'Bearer ';

/**
 * Verifies the `Authorization: Bearer <idToken>` header and attaches `req.auth`.
 * Rejects requests with a missing/invalid token, or a token with no role claim.
 */
export function authenticate(verifier: TokenVerifier): RequestHandler {
  return (req, _res, next) => {
    const header = req.headers.authorization;
    if (!header || !header.startsWith(BEARER_PREFIX)) {
      next(new AppError(401, 'Missing or malformed Authorization header'));
      return;
    }

    const token = header.slice(BEARER_PREFIX.length).trim();
    verifier
      .verify(token)
      .then((decoded) => {
        if (!decoded.role) {
          next(new AppError(403, 'Account has no role assigned'));
          return;
        }
        req.auth = { uid: decoded.uid, email: decoded.email, role: decoded.role };
        next();
      })
      .catch(() => next(new AppError(401, 'Invalid or expired token')));
  };
}

/** Allows the request only if the authenticated user has one of the given roles. */
export function requireRole(...roles: Role[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.auth) {
      next(new AppError(401, 'Not authenticated'));
      return;
    }
    if (!roles.includes(req.auth.role)) {
      next(new AppError(403, 'Forbidden'));
      return;
    }
    next();
  };
}
