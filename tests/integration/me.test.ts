import request from 'supertest';
import { createApp } from '../../src/app';
import { createContainer } from '../../src/container';
import { DecodedToken, TokenVerifier } from '../../src/services/auth/tokenVerifier';

const verifier = (decoded: DecodedToken): TokenVerifier => ({
  verify: async () => decoded,
});

const appWith = (v: TokenVerifier) => createApp(createContainer({ tokenVerifier: v }));

describe('GET /api/me', () => {
  it('returns the authenticated user for a valid token', async () => {
    const app = appWith(verifier({ uid: 'u1', email: 'admin@dcpl.test', role: 'admin' }));

    const res = await request(app).get('/api/me').set('Authorization', 'Bearer good');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ uid: 'u1', email: 'admin@dcpl.test', role: 'admin' });
  });

  it('returns 401 without a token', async () => {
    const app = appWith(verifier({ uid: 'u1', role: 'admin' }));

    const res = await request(app).get('/api/me');

    expect(res.status).toBe(401);
  });
});
