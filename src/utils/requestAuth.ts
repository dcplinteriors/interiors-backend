import { Request } from 'express';
import { AuthUser } from '../types/auth';
import { AppError } from './AppError';

/**
 * Returns the authenticated user, making the "an auth middleware ran first" invariant
 * explicit instead of scattering `req.auth!` non-null assertions across controllers.
 */
export function authOf(req: Request): AuthUser {
  if (!req.auth) {
    throw new AppError(401, 'Not authenticated');
  }
  return req.auth;
}
