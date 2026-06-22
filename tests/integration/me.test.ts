import request from 'supertest';
import { createApp } from '../../src/app';
import { createContainer } from '../../src/container';
import { DecodedToken, TokenVerifier } from '../../src/services/auth/tokenVerifier';
import { FakeUserRepository } from '../fakes/fakeUserRepository';
import { UserRecord } from '../../src/models/user';

const verifier = (decoded: DecodedToken): TokenVerifier => ({
  verify: async () => decoded,
});

const appWith = (v: TokenVerifier, users: UserRecord[] = []) =>
  createApp(createContainer({ tokenVerifier: v, userRepository: new FakeUserRepository(users) }));

const supervisor = (over: Partial<UserRecord> = {}): UserRecord => ({
  uid: 'sup1',
  role: 'supervisor',
  name: 'Ravi',
  email: 'ravi@dcpl.test',
  isActive: true,
  createdAt: '2026-06-01T00:00:00.000Z',
  ...over,
});

describe('GET /api/me', () => {
  it('returns the profile (token identity + record name/photo)', async () => {
    const app = appWith(verifier({ uid: 'sup1', email: 'ravi@dcpl.test', role: 'supervisor' }), [
      supervisor({ photoUrl: 'p.jpg' }),
    ]);
    const res = await request(app).get('/api/me').set('Authorization', 'Bearer good');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      uid: 'sup1',
      email: 'ravi@dcpl.test',
      role: 'supervisor',
      name: 'Ravi',
      photoUrl: 'p.jpg',
    });
  });

  it('returns null name/photo when there is no user record (token-only, e.g. seeded admin)', async () => {
    const app = appWith(verifier({ uid: 'u1', email: 'admin@dcpl.test', role: 'admin' }));
    const res = await request(app).get('/api/me').set('Authorization', 'Bearer good');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      uid: 'u1',
      email: 'admin@dcpl.test',
      role: 'admin',
      name: null,
      photoUrl: null,
    });
  });

  it('returns 401 without a token', async () => {
    const app = appWith(verifier({ uid: 'u1', role: 'admin' }));
    const res = await request(app).get('/api/me');
    expect(res.status).toBe(401);
  });
});

describe('PATCH /api/me', () => {
  it('lets a supervisor update name + own profile photoUrl', async () => {
    const app = appWith(verifier({ uid: 'sup1', email: 'ravi@dcpl.test', role: 'supervisor' }), [
      supervisor(),
    ]);
    const res = await request(app)
      .patch('/api/me')
      .set('Authorization', 'Bearer good')
      .send({ name: 'Ravi K', photoUrl: 'profiles/sup1/new.jpg' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ name: 'Ravi K', photoUrl: 'profiles/sup1/new.jpg' });
  });

  it('rejects a photoUrl that is not the caller’s own profile path (400)', async () => {
    const app = appWith(verifier({ uid: 'sup1', role: 'supervisor' }), [supervisor()]);
    const res = await request(app)
      .patch('/api/me')
      .set('Authorization', 'Bearer good')
      .send({ photoUrl: 'profiles/other/x.jpg' });
    expect(res.status).toBe(400);
  });

  it('forbids an admin from editing a profile (403)', async () => {
    const app = appWith(verifier({ uid: 'admin1', role: 'admin' }));
    const res = await request(app)
      .patch('/api/me')
      .set('Authorization', 'Bearer good')
      .send({ name: 'X' });
    expect(res.status).toBe(403);
  });

  it('rejects an empty/invalid body (400)', async () => {
    const app = appWith(verifier({ uid: 'sup1', role: 'supervisor' }), [supervisor()]);
    const res = await request(app)
      .patch('/api/me')
      .set('Authorization', 'Bearer good')
      .send({ name: '' }); // fails min(1)
    expect(res.status).toBe(400);
  });

  it('rejects a truly-empty patch with no fields (400)', async () => {
    const app = appWith(verifier({ uid: 'sup1', role: 'supervisor' }), [supervisor()]);
    const res = await request(app)
      .patch('/api/me')
      .set('Authorization', 'Bearer good')
      .send({});
    expect(res.status).toBe(400);
  });
});
