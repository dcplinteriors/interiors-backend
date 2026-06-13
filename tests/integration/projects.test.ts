import request from 'supertest';
import { adminVerifier, buildApp, bearer, supervisorVerifier } from '../helpers/testApp';
import { TokenVerifier } from '../../src/services/auth/tokenVerifier';
import { FakeProjectRepository } from '../fakes/fakeProjectRepository';
import { FakeCounterRepository } from '../fakes/fakeCounterRepository';
import { FakeUserRepository } from '../fakes/fakeUserRepository';
import { Project } from '../../src/models/project';
import { UserRecord } from '../../src/models/user';

const project = (over: Partial<Project> = {}): Project => ({
  id: 'p1',
  particular: 'Lobby fit-out',
  clientName: 'Acme',
  date: '2025-06-10',
  po: 'PO_25-26_06/0001',
  supervisorId: null,
  status: 'active',
  createdAt: '2025-06-01T00:00:00.000Z',
  createdBy: 'admin1',
  ...over,
});

const supervisorRecord = (uid: string): UserRecord => ({
  uid,
  role: 'supervisor',
  name: uid,
  email: `${uid}@dcpl.test`,
  isActive: true,
  createdAt: '2025-06-01T00:00:00.000Z',
});

function setup(verifier: TokenVerifier = adminVerifier, seedProjects: Project[] = [], seedUsers: UserRecord[] = []) {
  const projectRepository = new FakeProjectRepository(seedProjects);
  const counterRepository = new FakeCounterRepository();
  const userRepository = new FakeUserRepository(seedUsers);
  const app = buildApp({ tokenVerifier: verifier, projectRepository, counterRepository, userRepository });
  return { app, projectRepository, userRepository };
}

describe('POST /api/projects', () => {
  it('creates a project with a generated PO number (admin)', async () => {
    const { app } = setup();

    const res = await request(app)
      .post('/api/projects')
      .set(...bearer())
      .send({ particular: 'Lobby', clientName: 'Acme', date: '2025-06-10' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      particular: 'Lobby',
      clientName: 'Acme',
      po: 'PO_25-26_06/0001',
      supervisorId: null,
      status: 'active',
      createdBy: 'admin1',
    });
  });

  it('forbids a supervisor from creating projects (403)', async () => {
    const { app } = setup(supervisorVerifier());
    const res = await request(app)
      .post('/api/projects')
      .set(...bearer())
      .send({ particular: 'X', clientName: 'Y', date: '2025-06-10' });
    expect(res.status).toBe(403);
  });

  it('rejects an invalid body (400)', async () => {
    const { app } = setup();
    const res = await request(app)
      .post('/api/projects')
      .set(...bearer())
      .send({ particular: 'X' });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/projects', () => {
  it('returns all projects for an admin, each with the assigned supervisor name', async () => {
    const { app } = setup(
      adminVerifier,
      [project({ id: 'p1', supervisorId: 'sup1' }), project({ id: 'p2', supervisorId: null })],
      [supervisorRecord('sup1')],
    );
    const res = await request(app).get('/api/projects').set(...bearer());
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(2);
    expect(res.body.nextCursor).toBeNull();
    const byId = Object.fromEntries(res.body.items.map((p: { id: string }) => [p.id, p]));
    expect(byId['p1'].supervisorName).toBe('sup1'); // supervisorRecord names the user by uid
    expect(byId['p2'].supervisorName).toBeNull(); // unassigned → null
  });

  it('returns only own projects for a supervisor', async () => {
    const { app } = setup(supervisorVerifier('sup1'), [
      project({ id: 'p1', supervisorId: 'sup1' }),
      project({ id: 'p2', supervisorId: 'sup2' }),
    ]);
    const res = await request(app).get('/api/projects').set(...bearer());
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].id).toBe('p1');
  });

  it('cursor-paginates with limit, exposing nextCursor', async () => {
    const { app } = setup(adminVerifier, [
      project({ id: 'p1', createdAt: '2025-06-01T00:00:00.000Z' }),
      project({ id: 'p2', createdAt: '2025-06-02T00:00:00.000Z' }),
      project({ id: 'p3', createdAt: '2025-06-03T00:00:00.000Z' }),
    ]);

    const first = await request(app).get('/api/projects?limit=2').set(...bearer());
    expect(first.status).toBe(200);
    expect(first.body.items.map((p: { id: string }) => p.id)).toEqual(['p3', 'p2']);
    expect(first.body.nextCursor).toBeTruthy();

    const second = await request(app)
      .get(`/api/projects?limit=2&cursor=${encodeURIComponent(first.body.nextCursor)}`)
      .set(...bearer());
    expect(second.body.items.map((p: { id: string }) => p.id)).toEqual(['p1']);
    expect(second.body.nextCursor).toBeNull();
  });
});

describe('GET /api/projects/:id', () => {
  it('lets a supervisor read their own project', async () => {
    const { app } = setup(supervisorVerifier('sup1'), [project({ id: 'p1', supervisorId: 'sup1' })]);
    const res = await request(app).get('/api/projects/p1').set(...bearer());
    expect(res.status).toBe(200);
  });

  it('forbids a supervisor from reading another project (403)', async () => {
    const { app } = setup(supervisorVerifier('sup1'), [project({ id: 'p1', supervisorId: 'sup2' })]);
    const res = await request(app).get('/api/projects/p1').set(...bearer());
    expect(res.status).toBe(403);
  });

  it('returns 404 for a missing project', async () => {
    const { app } = setup(adminVerifier, []);
    const res = await request(app).get('/api/projects/nope').set(...bearer());
    expect(res.status).toBe(404);
  });
});

describe('POST /api/projects/:id/assign', () => {
  it('assigns an existing supervisor (admin)', async () => {
    const { app } = setup(adminVerifier, [project({ id: 'p1' })], [supervisorRecord('sup1')]);
    const res = await request(app)
      .post('/api/projects/p1/assign')
      .set(...bearer())
      .send({ supervisorId: 'sup1' });
    expect(res.status).toBe(200);
    expect(res.body.supervisorId).toBe('sup1');
    expect(res.body.supervisorName).toBe('sup1'); // resolved name returned, no client refetch
  });

  it('rejects assigning a non-existent supervisor (400)', async () => {
    const { app } = setup(adminVerifier, [project({ id: 'p1' })], []);
    const res = await request(app)
      .post('/api/projects/p1/assign')
      .set(...bearer())
      .send({ supervisorId: 'ghost' });
    expect(res.status).toBe(400);
  });

  it('returns 404 when assigning on a missing project', async () => {
    const { app } = setup(adminVerifier, [], [supervisorRecord('sup1')]);
    const res = await request(app)
      .post('/api/projects/nope/assign')
      .set(...bearer())
      .send({ supervisorId: 'sup1' });
    expect(res.status).toBe(404);
  });

  it('forbids a supervisor from assigning (403)', async () => {
    const { app } = setup(supervisorVerifier('sup1'), [project({ id: 'p1' })], [supervisorRecord('sup1')]);
    const res = await request(app)
      .post('/api/projects/p1/assign')
      .set(...bearer())
      .send({ supervisorId: 'sup1' });
    expect(res.status).toBe(403);
  });
});

describe('projects auth', () => {
  it('requires authentication (401)', async () => {
    const { app } = setup();
    const res = await request(app).get('/api/projects');
    expect(res.status).toBe(401);
  });
});
