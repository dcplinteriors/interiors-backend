import request from 'supertest';
import { adminVerifier, buildApp, bearer, supervisorVerifier } from '../helpers/testApp';
import { TokenVerifier } from '../../src/services/auth/tokenVerifier';
import { FakeUserRepository } from '../fakes/fakeUserRepository';
import { FakeProjectRepository } from '../fakes/fakeProjectRepository';
import { FakeAuthAdmin } from '../fakes/fakeAuthAdmin';
import { FakeInviteEmailService } from '../fakes/fakeInviteEmailService';
import { UserRecord } from '../../src/models/user';
import { Project } from '../../src/models/project';

const supervisor = (over: Partial<UserRecord> = {}): UserRecord => ({
  uid: 'sup1',
  role: 'supervisor',
  name: 'S',
  email: 's@dcpl.test',
  isActive: true,
  createdAt: '2025-06-01T00:00:00.000Z',
  ...over,
});

function setup(verifier: TokenVerifier = adminVerifier, seed: UserRecord[] = [], projects: Project[] = []) {
  const userRepository = new FakeUserRepository(seed);
  const projectRepository = new FakeProjectRepository(projects);
  const authAdmin = new FakeAuthAdmin();
  const inviteEmail = new FakeInviteEmailService();
  const app = buildApp({
    tokenVerifier: verifier,
    userRepository,
    projectRepository,
    authAdmin,
    inviteEmail,
  });
  return { app, userRepository, authAdmin, inviteEmail };
}

describe('POST /api/supervisors', () => {
  it('creates a supervisor: Auth user, role claim, record, invite email', async () => {
    const { app, userRepository, authAdmin, inviteEmail } = setup();

    const res = await request(app)
      .post('/api/supervisors')
      .set(...bearer())
      .send({ name: 'Ravi', email: 'ravi@dcpl.test', phone: '9876543210' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      role: 'supervisor',
      name: 'Ravi',
      email: 'ravi@dcpl.test',
      isActive: true,
      mustChangePassword: true,
      createdBy: 'admin1',
    });
    expect(res.body.uid).toBeTruthy();
    expect(authAdmin.roles.get(res.body.uid)).toBe('supervisor');
    expect(inviteEmail.sent).toContain('ravi@dcpl.test');
    expect(await userRepository.findByUid(res.body.uid)).not.toBeNull();
  });

  it('normalizes the email to lowercase (Auth user, record, and dedup agree)', async () => {
    const { app, authAdmin } = setup();

    const res = await request(app)
      .post('/api/supervisors')
      .set(...bearer())
      .send({ name: 'Ravi', email: 'Ravi.K@DCPL.test' });

    expect(res.status).toBe(201);
    expect(res.body.email).toBe('ravi.k@dcpl.test');
    expect(authAdmin.created[0].email).toBe('ravi.k@dcpl.test');
  });

  it('treats a different-cased email as a duplicate (409)', async () => {
    const { app } = setup(adminVerifier, [supervisor({ email: 'dupe@dcpl.test' })]);

    const res = await request(app)
      .post('/api/supervisors')
      .set(...bearer())
      .send({ name: 'X', email: 'DUPE@dcpl.test' });

    expect(res.status).toBe(409);
  });

  it('rejects a duplicate email with 409 (no Auth user or email)', async () => {
    const { app, authAdmin, inviteEmail } = setup(adminVerifier, [supervisor({ email: 'dupe@dcpl.test' })]);

    const res = await request(app)
      .post('/api/supervisors')
      .set(...bearer())
      .send({ name: 'X', email: 'dupe@dcpl.test' });

    expect(res.status).toBe(409);
    expect(authAdmin.created).toHaveLength(0);
    expect(inviteEmail.sent).toHaveLength(0);
  });

  it('maps a Firebase auth/email-already-exists to 409 (not 500)', async () => {
    const userRepository = new FakeUserRepository(); // empty → users-doc dedup passes
    const authAdmin = {
      createUser: async () => {
        throw Object.assign(new Error('exists'), { code: 'auth/email-already-exists' });
      },
      setRole: async () => {},
    };
    const app = buildApp({
      tokenVerifier: adminVerifier,
      userRepository,
      authAdmin,
      inviteEmail: new FakeInviteEmailService(),
    });

    const res = await request(app)
      .post('/api/supervisors')
      .set(...bearer())
      .send({ name: 'Ghost', email: 'ghost@dcpl.test' });

    expect(res.status).toBe(409);
  });

  it('rejects an invalid body with 400', async () => {
    const { app } = setup();

    const res = await request(app)
      .post('/api/supervisors')
      .set(...bearer())
      .send({ name: 'X' }); // missing email

    expect(res.status).toBe(400);
  });

  it('forbids a supervisor from creating supervisors (403)', async () => {
    const { app } = setup(supervisorVerifier());

    const res = await request(app)
      .post('/api/supervisors')
      .set(...bearer())
      .send({ name: 'X', email: 'x@dcpl.test' });

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
      supervisor({ uid: 'sup1', email: 'a@dcpl.test', createdAt: '2025-06-01T00:00:00.000Z' }),
      supervisor({ uid: 'sup2', email: 'b@dcpl.test', createdAt: '2025-06-02T00:00:00.000Z' }),
      supervisor({ uid: 'sup3', email: 'c@dcpl.test', createdAt: '2025-06-03T00:00:00.000Z' }),
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

  it('includes each supervisor’s assigned project names (empty when none)', async () => {
    const proj = (over: Partial<Project>): Project => ({
      id: 'p1',
      particular: 'Lobby',
      clientName: 'Acme',
      date: '2025-06-10',
      po: 'PO_25-26_06/0001',
      supervisorId: null,
      status: 'active',
      createdAt: '2025-06-01T00:00:00.000Z',
      createdBy: 'admin1',
      ...over,
    });
    const { app } = setup(
      adminVerifier,
      [supervisor({ uid: 'sup1', email: 'a@dcpl.test' }), supervisor({ uid: 'sup2', email: 'b@dcpl.test' })],
      [
        proj({ id: 'p1', particular: 'Lobby', supervisorId: 'sup1', createdAt: '2025-06-02T00:00:00.000Z' }),
        proj({ id: 'p2', particular: 'Tower', supervisorId: 'sup1', createdAt: '2025-06-01T00:00:00.000Z' }),
      ],
    );

    const res = await request(app).get('/api/supervisors').set(...bearer());

    const byUid = Object.fromEntries(res.body.items.map((s: { uid: string }) => [s.uid, s]));
    expect(byUid['sup1'].projects).toEqual(['Lobby', 'Tower']); // newest-first by createdAt
    expect(byUid['sup2'].projects).toEqual([]);
  });

  it('requires authentication (401)', async () => {
    const { app } = setup();
    const res = await request(app).get('/api/supervisors');
    expect(res.status).toBe(401);
  });
});
