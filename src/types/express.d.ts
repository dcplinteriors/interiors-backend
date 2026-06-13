import { AuthUser } from './auth';

// Augment Express's Request with the authenticated user set by the auth middleware.
declare global {
  namespace Express {
    interface Request {
      auth?: AuthUser;
    }
  }
}

export {};
