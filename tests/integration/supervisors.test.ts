import request from 'supertest';
import { adminVerifier, buildApp, bearer, supervisorVerifier } from '../helpers/testApp';
import { TokenVerifier } from '../../src/services/auth/tokenVerifier';
import { FakeUserRepository } from '../fakes/fakeUserRepository';
import { FakeWorkOrderRepository } from '../fakes/fakeWorkOrderRepository';
import { FakeAuthAdmin } from '../fakes/fakeAuthAdmin';
import { UserRecord } from '../../src/models/user';
import { WorkOrder } from '../../src/models/workOrder';
import { SYNTHETIC_EMAIL_DOMAIN } from '../../src/utils/phone';

const PHONE = '9876543210';
const SYNTHETIC = `919876543210@${SYNTHETIC_EMAIL_DOMAIN}`;

const supervisor = (over: Partial<UserRecord> = {}): UserRecord => ({
  uid: 'sup1',
  role: 'supervisor',
  name: 'S',
  email: 's@dcpl.test',
  isActive: true,
  createdAt: '2026-06-01T00:00:00.000Z',
  ...over,
});

function setup(
  verifier: TokenVerifier = adminVerifier,
  seed: UserRecord[] = [],
  workOrders: WorkOrder[] = [],
) {
  const userRepository = new FakeUserRepository(seed);
  const workOrderRepository = new FakeWorkOrderRepository(workOrders);
  const authAdmin = new FakeAuthAdmin();
  const app = buildApp({
    tokenVerifier: verifier,
    userRepository,
    workOrderRepository,
    authAdmin,
  });
  return { app, userRepository, authAdmin };
}

describe('POST /api/supervisors', () => {
  it('creates a supervisor: Auth user (with temp password), role claim, record', async () => {
    const { app, userRepository, authAdmin } = setup();

    const res = await request(app)
      .post('/api/supervisors')
      .set(...bearer())
      .send({ name: 'Ravi', phone: PHONE });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      role: 'supervisor',
      name: 'Ravi',
      email: SYNTHETIC,
      phone: '919876543210',
      isActive: true,
      mustChangePassword: true,
      createdBy: 'admin1',
      workOrders: [],
    });
    expect(res.body.uid).toBeTruthy();
    // The one-time temp password is returned so the admin can relay it.
    expect(typeof res.body.tempPassword).toBe('string');
    expect(res.body.tempPassword.length).toBeGreaterThanOrEqual(6);

    expect(authAdmin.roles.get(res.body.uid)).toBe('supervisor');
    // Auth user was created with the synthetic email + the returned temp password.
    expect(authAdmin.created[0]).toMatchObject({ email: SYNTHETIC, password: res.body.tempPassword });

    const stored = await userRepository.findByUid(res.body.uid);
    expect(stored).toMatchObject({ email: SYNTHETIC, phone: '919876543210', mustChangePassword: true });
  });

  it('normalizes a messy phone to the canonical synthetic email', async () => {
    const { app, authAdmin } = setup();

    const res = await request(app)
      .post('/api/supervisors')
      .set(...bearer())
      .send({ name: 'Ravi', phone: '+91 (98765) 43210' });

    expect(res.status).toBe(201);
    expect(res.body.email).toBe(SYNTHETIC);
    expect(authAdmin.created[0].email).toBe(SYNTHETIC);
  });

  it('rejects an invalid phone with 400 (no Auth user)', async () => {
    const { app, authAdmin } = setup();

    const res = await request(app)
      .post('/api/supervisors')
      .set(...bearer())
      .send({ name: 'Ravi', phone: '12345' }); // too few digits

    expect(res.status).toBe(400);
    expect(authAdmin.created).toHaveLength(0);
  });

  it('rejects a duplicate phone with 409 (no Auth user)', async () => {
    const { app, authAdmin } = setup(adminVerifier, [supervisor({ email: SYNTHETIC })]);

    const res = await request(app)
      .post('/api/supervisors')
      .set(...bearer())
      .send({ name: 'X', phone: PHONE });

    expect(res.status).toBe(409);
    expect(authAdmin.created).toHaveLength(0);
  });

  it('treats a differently-formatted but equivalent phone as a duplicate (409)', async () => {
    const { app } = setup(adminVerifier, [supervisor({ email: SYNTHETIC })]);

    const res = await request(app)
      .post('/api/supervisors')
      .set(...bearer())
      .send({ name: 'X', phone: '919876543210' });

    expect(res.status).toBe(409);
  });

  it('maps a Firebase auth/email-already-exists to 409 (not 500)', async () => {
    const userRepository = new FakeUserRepository(); // empty → users-doc dedup passes
    const authAdmin = {
      createUser: async () => {
        throw Object.assign(new Error('exists'), { code: 'auth/email-already-exists' });
      },
      setRole: async () => {},
      setPassword: async () => {},
      revokeRefreshTokens: async () => {},
    };
    const app = buildApp({ tokenVerifier: adminVerifier, userRepository, authAdmin });

    const res = await request(app)
      .post('/api/supervisors')
      .set(...bearer())
      .send({ name: 'Ghost', phone: PHONE });

    expect(res.status).toBe(409);
  });

  it('rejects an invalid body with 400', async () => {
    const { app } = setup();

    const res = await request(app)
      .post('/api/supervisors')
      .set(...bearer())
      .send({ name: 'X' }); // missing phone

    expect(res.status).toBe(400);
  });

  it('forbids a supervisor from creating supervisors (403)', async () => {
    const { app } = setup(supervisorVerifier());

    const res = await request(app)
      .post('/api/supervisors')
      .set(...bearer())
      .send({ name: 'X', phone: PHONE });

    expect(res.status).toBe(403);
  });
});

describe('POST /api/supervisors/:id/reset-password', () => {
  it('issues a fresh temp password, revokes sessions, and re-flags mustChangePassword', async () => {
    const { app, userRepository, authAdmin } = setup(adminVerifier, [
      supervisor({ uid: 'sup1', email: SYNTHETIC, mustChangePassword: false }),
    ]);

    const res = await request(app)
      .post('/api/supervisors/sup1/reset-password')
      .set(...bearer());

    expect(res.status).toBe(200);
    expect(typeof res.body.tempPassword).toBe('string');
    expect(res.body.tempPassword.length).toBeGreaterThanOrEqual(6);

    expect(authAdmin.passwords.get('sup1')).toBe(res.body.tempPassword);
    expect(authAdmin.revoked).toContain('sup1');
    expect((await userRepository.findByUid('sup1'))?.mustChangePassword).toBe(true);
  });

  it('returns 404 for an unknown uid', async () => {
    const { app } = setup();
    const res = await request(app).post('/api/supervisors/nope/reset-password').set(...bearer());
    expect(res.status).toBe(404);
  });

  it('returns 404 when the uid is not a supervisor', async () => {
    const { app } = setup(adminVerifier, [
      { uid: 'admin2', role: 'admin', name: 'A', email: 'a@dcpl.test', isActive: true, createdAt: 'x' },
    ]);
    const res = await request(app).post('/api/supervisors/admin2/reset-password').set(...bearer());
    expect(res.status).toBe(404);
  });

  it('forbids a supervisor from resetting passwords (403)', async () => {
    const { app } = setup(supervisorVerifier(), [supervisor({ uid: 'sup1', email: SYNTHETIC })]);
    const res = await request(app).post('/api/supervisors/sup1/reset-password').set(...bearer());
    expect(res.status).toBe(403);
  });
});

describe('GET /api/supervisors', () => {
  it('lists only supervisors for an admin', async () => {
    const { app } = setup(adminVerifier, [
      supervisor({ uid: 'sup1', email: 'a@dcpl.test' }),
      supervisor({ uid: 'sup2', email: 'b@dcpl.test' }),
      { uid: 'admin1', role: 'admin', name: 'A', email: 'admin@dcpl.test', isActive: true, createdAt: 'x' },
    ]);

    const res = await request(app).get('/api/supervisors').set(...bearer());

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(2);
    expect(res.body.nextCursor).toBeNull();
  });

  it('cursor-paginates supervisors with limit, exposing nextCursor', async () => {
    const { app } = setup(adminVerifier, [
      supervisor({ uid: 'sup1', email: 'a@dcpl.test', createdAt: '2026-06-01T00:00:00.000Z' }),
      supervisor({ uid: 'sup2', email: 'b@dcpl.test', createdAt: '2026-06-02T00:00:00.000Z' }),
      supervisor({ uid: 'sup3', email: 'c@dcpl.test', createdAt: '2026-06-03T00:00:00.000Z' }),
    ]);

    const first = await request(app).get('/api/supervisors?limit=2').set(...bearer());
    expect(first.body.items.map((s: { uid: string }) => s.uid)).toEqual(['sup3', 'sup2']);
    expect(first.body.nextCursor).toBeTruthy();

    const second = await request(app)
      .get(`/api/supervisors?limit=2&cursor=${encodeURIComponent(first.body.nextCursor)}`)
      .set(...bearer());
    expect(second.body.items.map((s: { uid: string }) => s.uid)).toEqual(['sup1']);
    expect(second.body.nextCursor).toBeNull();
  });

  it('includes each supervisor’s assigned work-order names (empty when none)', async () => {
    const wo = (over: Partial<WorkOrder>): WorkOrder => ({
      id: 'wo1',
      project: 'p1',
      number: '26-27_0001/0001',
      name: 'WO',
      date: '2026-06-10',
      description: null,
      supervisorId: null,
      status: 'active',
      createdAt: '2026-06-01T00:00:00.000Z',
      createdBy: 'admin1',
      ...over,
    });
    const { app } = setup(
      adminVerifier,
      [supervisor({ uid: 'sup1', email: 'a@dcpl.test' }), supervisor({ uid: 'sup2', email: 'b@dcpl.test' })],
      [
        wo({ id: 'w1', name: 'Lobby WO', supervisorId: 'sup1', createdAt: '2026-06-02T00:00:00.000Z' }),
        wo({ id: 'w2', name: 'Tower WO', supervisorId: 'sup1', createdAt: '2026-06-01T00:00:00.000Z' }),
      ],
    );

    const res = await request(app).get('/api/supervisors').set(...bearer());

    const byUid = Object.fromEntries(res.body.items.map((s: { uid: string }) => [s.uid, s]));
    expect(byUid['sup1'].workOrders).toEqual(['Lobby WO', 'Tower WO']); // newest-first by createdAt
    expect(byUid['sup2'].workOrders).toEqual([]);
  });

  it('requires authentication (401)', async () => {
    const { app } = setup();
    const res = await request(app).get('/api/supervisors');
    expect(res.status).toBe(401);
  });
});
