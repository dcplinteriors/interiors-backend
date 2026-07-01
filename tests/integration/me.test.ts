import request from 'supertest';
import { createApp } from '../../src/app';
import { createContainer } from '../../src/container';
import { DecodedToken, TokenVerifier } from '../../src/services/auth/tokenVerifier';
import { FakeUserRepository } from '../fakes/fakeUserRepository';
import { FakeStorageService } from '../fakes/fakeStorageService';
import { UserRecord } from '../../src/models/user';

const verifier = (decoded: DecodedToken): TokenVerifier => ({
  verify: async () => decoded,
});

const appWith = (v: TokenVerifier, users: UserRecord[] = []) =>
  createApp(
    createContainer({
      tokenVerifier: v,
      userRepository: new FakeUserRepository(users),
      storageService: new FakeStorageService(),
    }),
  );

const supervisor = (over: Partial<UserRecord> = {}): UserRecord => ({
  uid: 'sup1',
  role: 'supervisor',
  name: 'Ravi',
  email: 'ravi@dcpl.test',
  phone: '919876543210',
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
      phone: '919876543210',
      photoUrl: 'p.jpg',
      mustChangePassword: false,
    });
  });

  it('reflects mustChangePassword from the record (temp-password gate)', async () => {
    const app = appWith(verifier({ uid: 'sup1', email: 'ravi@dcpl.test', role: 'supervisor' }), [
      supervisor({ mustChangePassword: true }),
    ]);
    const res = await request(app).get('/api/me').set('Authorization', 'Bearer good');
    expect(res.status).toBe(200);
    expect(res.body.mustChangePassword).toBe(true);
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
      phone: null,
      photoUrl: null,
      mustChangePassword: false,
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
      // Client submits the staged path; the server finalizes it to the permanent key.
      .send({ name: 'Ravi K', photoUrl: 'tmp/profiles/sup1/new.jpg' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ name: 'Ravi K', photoUrl: 'profiles/sup1/new.jpg' });
  });

  it('rejects a photoUrl that is not the caller’s own profile path (400)', async () => {
    const app = appWith(verifier({ uid: 'sup1', role: 'supervisor' }), [supervisor()]);
    const res = await request(app)
      .patch('/api/me')
      .set('Authorization', 'Bearer good')
      .send({ photoUrl: 'tmp/profiles/other/x.jpg' });
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

describe('POST /api/me/password-changed', () => {
  it('clears the caller’s mustChangePassword flag', async () => {
    const users = new FakeUserRepository([supervisor({ mustChangePassword: true })]);
    const app = createApp(
      createContainer({
        tokenVerifier: verifier({ uid: 'sup1', email: 'ravi@dcpl.test', role: 'supervisor' }),
        userRepository: users,
        storageService: new FakeStorageService(),
      }),
    );

    const res = await request(app)
      .post('/api/me/password-changed')
      .set('Authorization', 'Bearer good');

    expect(res.status).toBe(200);
    expect(res.body.mustChangePassword).toBe(false);
    expect((await users.findByUid('sup1'))?.mustChangePassword).toBe(false);
  });

  it('returns 404 when the caller has no user record', async () => {
    const app = appWith(verifier({ uid: 'ghost', role: 'supervisor' }));
    const res = await request(app)
      .post('/api/me/password-changed')
      .set('Authorization', 'Bearer good');
    expect(res.status).toBe(404);
  });

  it('returns 401 without a token', async () => {
    const app = appWith(verifier({ uid: 'sup1', role: 'supervisor' }), [supervisor()]);
    const res = await request(app).post('/api/me/password-changed');
    expect(res.status).toBe(401);
  });
});
