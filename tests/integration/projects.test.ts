import request from 'supertest';
import { adminVerifier, buildApp, bearer, supervisorVerifier } from '../helpers/testApp';
import { TokenVerifier } from '../../src/services/auth/tokenVerifier';
import { FakeProjectRepository } from '../fakes/fakeProjectRepository';
import { FakeWorkOrderRepository } from '../fakes/fakeWorkOrderRepository';
import { FakeCounterRepository } from '../fakes/fakeCounterRepository';
import { Project } from '../../src/models/project';
import { WorkOrder } from '../../src/models/workOrder';

const project = (over: Partial<Project> = {}): Project => ({
  id: 'p1',
  number: '26-27_0001',
  name: 'Lobby fit-out',
  clientName: 'Acme',
  projectEngineer: 'Eng',
  status: 'active',
  createdAt: '2026-06-01T00:00:00.000Z',
  createdBy: 'admin1',
  ...over,
});

const workOrder = (over: Partial<WorkOrder> = {}): WorkOrder => ({
  id: 'wo1',
  project: 'p1',
  number: '26-27_0001/0001',
  name: 'WO A',
  date: '2026-06-10',
  description: null,
  supervisorId: null,
  status: 'pending',
  createdAt: '2026-06-01T00:00:00.000Z',
  createdBy: 'admin1',
  ...over,
});

function setup(
  verifier: TokenVerifier = adminVerifier,
  opts: { projects?: Project[]; workOrders?: WorkOrder[] } = {},
) {
  const projectRepository = new FakeProjectRepository(opts.projects ?? []);
  const workOrderRepository = new FakeWorkOrderRepository(opts.workOrders ?? []);
  const counterRepository = new FakeCounterRepository();
  const app = buildApp({
    tokenVerifier: verifier,
    projectRepository,
    workOrderRepository,
    counterRepository,
  });
  return { app, projectRepository, workOrderRepository };
}

describe('POST /api/projects', () => {
  it('creates a project with its work orders, generating hierarchical numbers (admin)', async () => {
    const { app, workOrderRepository } = setup();

    const res = await request(app)
      .post('/api/projects')
      .set(...bearer())
      .send({
        name: 'Lobby',
        clientName: 'Acme',
        projectEngineer: 'R. Sharma',
        workOrders: [
          { name: 'Civil', date: '2026-06-10' },
          { name: 'Electrical', date: '2026-06-11', description: 'wiring' },
        ],
      });

    expect(res.status).toBe(201);
    // Numbers are generated from the fixed test clock (June 2025 → FY 25-26).
    expect(res.body).toMatchObject({
      number: '25-26_0001',
      name: 'Lobby',
      clientName: 'Acme',
      projectEngineer: 'R. Sharma',
      status: 'active',
      createdBy: 'admin1',
    });
    expect(res.body.workOrders).toHaveLength(2);
    expect(res.body.workOrders.map((w: { number: string }) => w.number)).toEqual([
      '25-26_0001/0001',
      '25-26_0001/0002',
    ]);
    expect(res.body.workOrders[0]).toMatchObject({
      status: 'pending',
      supervisorId: null,
      projectName: 'Lobby',
    });
    expect((await workOrderRepository.list()).items).toHaveLength(2);
  });

  it('rejects a project with no work orders (400)', async () => {
    const { app } = setup();
    const res = await request(app)
      .post('/api/projects')
      .set(...bearer())
      .send({ name: 'X', clientName: 'Y', projectEngineer: 'Z', workOrders: [] });
    expect(res.status).toBe(400);
  });

  it('rejects more than 50 work orders (400)', async () => {
    const { app } = setup();
    const workOrders = Array.from({ length: 51 }, (_, i) => ({ name: `WO ${i}`, date: '2026-06-10' }));
    const res = await request(app)
      .post('/api/projects')
      .set(...bearer())
      .send({ name: 'X', clientName: 'Y', projectEngineer: 'Z', workOrders });
    expect(res.status).toBe(400);
  });

  it('forbids a supervisor from creating projects (403)', async () => {
    const { app } = setup(supervisorVerifier());
    const res = await request(app)
      .post('/api/projects')
      .set(...bearer())
      .send({
        name: 'X',
        clientName: 'Y',
        projectEngineer: 'Z',
        workOrders: [{ name: 'W', date: '2026-06-10' }],
      });
    expect(res.status).toBe(403);
  });

  it('rejects an invalid body (400)', async () => {
    const { app } = setup();
    const res = await request(app).post('/api/projects').set(...bearer()).send({ name: 'X' });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/projects', () => {
  it('returns all projects for an admin, each with a work-order count', async () => {
    const { app } = setup(adminVerifier, {
      projects: [project({ id: 'p1' }), project({ id: 'p2', createdAt: '2026-06-02T00:00:00.000Z' })],
      workOrders: [workOrder({ id: 'w1', project: 'p1' }), workOrder({ id: 'w2', project: 'p1' })],
    });
    const res = await request(app).get('/api/projects').set(...bearer());
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(2);
    const byId = Object.fromEntries(res.body.items.map((p: { id: string }) => [p.id, p]));
    expect(byId['p1'].workOrderCount).toBe(2);
    expect(byId['p2'].workOrderCount).toBe(0);
  });

  it('forbids a supervisor from listing projects (403)', async () => {
    const { app } = setup(supervisorVerifier('sup1'), { projects: [project()] });
    const res = await request(app).get('/api/projects').set(...bearer());
    expect(res.status).toBe(403);
  });

  it('cursor-paginates with limit', async () => {
    const { app } = setup(adminVerifier, {
      projects: [
        project({ id: 'p1', createdAt: '2026-06-01T00:00:00.000Z' }),
        project({ id: 'p2', createdAt: '2026-06-02T00:00:00.000Z' }),
        project({ id: 'p3', createdAt: '2026-06-03T00:00:00.000Z' }),
      ],
    });
    const first = await request(app).get('/api/projects?limit=2').set(...bearer());
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
  it('returns a project with all its work orders for an admin', async () => {
    const { app } = setup(adminVerifier, {
      projects: [project({ id: 'p1' })],
      workOrders: [
        workOrder({ id: 'w1', project: 'p1' }),
        workOrder({ id: 'w2', project: 'p1', supervisorId: 'sup2', status: 'active' }),
      ],
    });
    const res = await request(app).get('/api/projects/p1').set(...bearer());
    expect(res.status).toBe(200);
    expect(res.body.workOrders).toHaveLength(2);
  });

  it('shows a supervisor only their assigned work orders', async () => {
    const { app } = setup(supervisorVerifier('sup1'), {
      projects: [project({ id: 'p1' })],
      workOrders: [
        workOrder({ id: 'w1', project: 'p1', supervisorId: 'sup1', status: 'active' }),
        workOrder({ id: 'w2', project: 'p1', supervisorId: 'sup2', status: 'active' }),
      ],
    });
    const res = await request(app).get('/api/projects/p1').set(...bearer());
    expect(res.status).toBe(200);
    expect(res.body.workOrders.map((w: { id: string }) => w.id)).toEqual(['w1']);
  });

  it('forbids a supervisor with no work order on the project (403)', async () => {
    const { app } = setup(supervisorVerifier('sup1'), {
      projects: [project({ id: 'p1' })],
      workOrders: [workOrder({ id: 'w2', project: 'p1', supervisorId: 'sup2', status: 'active' })],
    });
    const res = await request(app).get('/api/projects/p1').set(...bearer());
    expect(res.status).toBe(403);
  });

  it('returns 404 for a missing project', async () => {
    const { app } = setup(adminVerifier, {});
    const res = await request(app).get('/api/projects/nope').set(...bearer());
    expect(res.status).toBe(404);
  });
});

describe('POST /api/projects/:id/work-orders', () => {
  it('adds a work order to an existing project (admin)', async () => {
    const { app } = setup(adminVerifier, { projects: [project({ id: 'p1', number: '26-27_0001' })] });
    const res = await request(app)
      .post('/api/projects/p1/work-orders')
      .set(...bearer())
      .send({ name: 'Plumbing', date: '2026-06-12' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      name: 'Plumbing',
      status: 'pending',
      number: '26-27_0001/0001',
    });
  });

  it('409 when adding to a completed project', async () => {
    const { app } = setup(adminVerifier, { projects: [project({ id: 'p1', status: 'completed' })] });
    const res = await request(app)
      .post('/api/projects/p1/work-orders')
      .set(...bearer())
      .send({ name: 'Plumbing', date: '2026-06-12' });
    expect(res.status).toBe(409);
  });
});

describe('POST /api/projects/:id/complete', () => {
  it('completes a project when every work order is completed/cancelled', async () => {
    const { app } = setup(adminVerifier, {
      projects: [project({ id: 'p1' })],
      workOrders: [
        workOrder({ id: 'w1', project: 'p1', status: 'completed' }),
        workOrder({ id: 'w2', project: 'p1', status: 'cancelled' }),
      ],
    });
    const res = await request(app).post('/api/projects/p1/complete').set(...bearer());
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('completed');
  });

  it('409 when a work order is still open', async () => {
    const { app } = setup(adminVerifier, {
      projects: [project({ id: 'p1' })],
      workOrders: [workOrder({ id: 'w1', project: 'p1', status: 'active', supervisorId: 'sup1' })],
    });
    const res = await request(app).post('/api/projects/p1/complete').set(...bearer());
    expect(res.status).toBe(409);
  });

  it('forbids a supervisor (403)', async () => {
    const { app } = setup(supervisorVerifier('sup1'), { projects: [project({ id: 'p1' })] });
    const res = await request(app).post('/api/projects/p1/complete').set(...bearer());
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
