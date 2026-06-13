import { Request, Response } from 'express';
import { authenticate, requireRole } from '../../src/middlewares/auth';
import { AppError } from '../../src/utils/AppError';
import { DecodedToken, TokenVerifier } from '../../src/services/auth/tokenVerifier';

const verifierReturning = (decoded: DecodedToken): TokenVerifier => ({
  verify: jest.fn(async () => decoded),
});

const verifierThrowing = (): TokenVerifier => ({
  verify: jest.fn(async () => {
    throw new Error('bad token');
  }),
});

/** Runs a middleware against a fake req and resolves with whatever it passed to next(). */
function runMiddleware(
  mw: ReturnType<typeof authenticate>,
  req: Partial<Request>,
): Promise<{ err?: unknown; req: Partial<Request> }> {
  return new Promise((resolve) => {
    mw(req as Request, {} as Response, (err?: unknown) => resolve({ err, req }));
  });
}

describe('authenticate', () => {
  it('attaches req.auth and calls next() for a valid token', async () => {
    const mw = authenticate(verifierReturning({ uid: 'u1', email: 'a@b.com', role: 'admin' }));
    const { err, req } = await runMiddleware(mw, { headers: { authorization: 'Bearer good' } });

    expect(err).toBeUndefined();
    expect(req.auth).toEqual({ uid: 'u1', email: 'a@b.com', role: 'admin' });
  });

  it('rejects a missing Authorization header with 401', async () => {
    const mw = authenticate(verifierReturning({ uid: 'u1', role: 'admin' }));
    const { err } = await runMiddleware(mw, { headers: {} });

    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).statusCode).toBe(401);
  });

  it('rejects a malformed header (no Bearer prefix) with 401', async () => {
    const mw = authenticate(verifierReturning({ uid: 'u1', role: 'admin' }));
    const { err } = await runMiddleware(mw, { headers: { authorization: 'token-only' } });

    expect((err as AppError).statusCode).toBe(401);
  });

  it('rejects an invalid token with 401', async () => {
    const mw = authenticate(verifierThrowing());
    const { err } = await runMiddleware(mw, { headers: { authorization: 'Bearer bad' } });

    expect((err as AppError).statusCode).toBe(401);
  });

  it('rejects a token with no role claim with 403', async () => {
    const mw = authenticate(verifierReturning({ uid: 'u1' }));
    const { err } = await runMiddleware(mw, { headers: { authorization: 'Bearer norole' } });

    expect((err as AppError).statusCode).toBe(403);
  });
});

describe('requireRole', () => {
  it('calls next() when the role matches', async () => {
    const { err } = await runMiddleware(requireRole('admin'), {
      auth: { uid: 'u1', role: 'admin' },
    });
    expect(err).toBeUndefined();
  });

  it('allows any of several roles', async () => {
    const { err } = await runMiddleware(requireRole('admin', 'supervisor'), {
      auth: { uid: 'u1', role: 'supervisor' },
    });
    expect(err).toBeUndefined();
  });

  it('rejects a mismatched role with 403', async () => {
    const { err } = await runMiddleware(requireRole('admin'), {
      auth: { uid: 'u1', role: 'supervisor' },
    });
    expect((err as AppError).statusCode).toBe(403);
  });

  it('rejects an unauthenticated request with 401', async () => {
    const { err } = await runMiddleware(requireRole('admin'), {});
    expect((err as AppError).statusCode).toBe(401);
  });
});
