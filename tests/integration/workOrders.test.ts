import request from 'supertest';
import { adminVerifier, buildApp, bearer, supervisorVerifier } from '../helpers/testApp';
import { TokenVerifier } from '../../src/services/auth/tokenVerifier';
import { FakeProjectRepository } from '../fakes/fakeProjectRepository';
import { FakeWorkOrderRepository } from '../fakes/fakeWorkOrderRepository';
import { FakeMaterialRequestRepository } from '../fakes/fakeMaterialRequestRepository';
import { FakeUserRepository } from '../fakes/fakeUserRepository';
import { FakeCounterRepository } from '../fakes/fakeCounterRepository';
import { Project } from '../../src/models/project';
import { WorkOrder } from '../../src/models/workOrder';
import { MaterialRequest } from '../../src/models/materialRequest';
import { UserRecord } from '../../src/models/user';

const project = (over: Partial<Project> = {}): Project => ({
  id: 'p1',
  number: '26-27_0001',
  name: 'Lobby',
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

const mr = (over: Partial<MaterialRequest> = {}): MaterialRequest => ({
  id: 'mr1',
  itemNumber: '26-27_0001/0001/0001',
  workOrder: 'wo1',
  project: 'p1',
  orderBy: 'sup1',
  supervisorId: 'sup1',
  batchId: 'b1',
  particular: 'Hinges',
  make: 'Hettich',
  size: '4 inch',
  quantity: 20,
  unit: 'PCS',
  attachments: { photos: [], audio: null },
  status: 'requested',
  createdAt: '2026-06-10T00:00:00.000Z',
  expectedDate: null,
  vendor: null,
  poNumber: null,
  remarks: null,
  billImages: [],
  ...over,
});

const supRecord = (uid: string): UserRecord => ({
  uid,
  role: 'supervisor',
  name: uid,
  email: `${uid}@dcpl.test`,
  isActive: true,
  createdAt: '2026-06-01T00:00:00.000Z',
});

function setup(
  verifier: TokenVerifier,
  opts: {
    projects?: Project[];
    workOrders?: WorkOrder[];
    requests?: MaterialRequest[];
    users?: UserRecord[];
  } = {},
) {
  const projectRepository = new FakeProjectRepository(opts.projects ?? [project()]);
  const workOrderRepository = new FakeWorkOrderRepository(opts.workOrders ?? []);
  const materialRequestRepository = new FakeMaterialRequestRepository(opts.requests ?? []);
  const userRepository = new FakeUserRepository(opts.users ?? []);
  const counterRepository = new FakeCounterRepository();
  const app = buildApp({
    tokenVerifier: verifier,
    projectRepository,
    workOrderRepository,
    materialRequestRepository,
    userRepository,
    counterRepository,
  });
  return { app, workOrderRepository, materialRequestRepository };
}

describe('GET /api/work-orders', () => {
  it('returns all for an admin and only assigned ones for a supervisor', async () => {
    const opts = {
      workOrders: [
        workOrder({ id: 'w1', supervisorId: 'sup1', status: 'active' }),
        workOrder({ id: 'w2', supervisorId: 'sup2', status: 'active' }),
      ],
    };
    const admin = await request(setup(adminVerifier, opts).app)
      .get('/api/work-orders')
      .set(...bearer());
    expect(admin.body.items).toHaveLength(2);

    const sup = await request(setup(supervisorVerifier('sup1'), opts).app)
      .get('/api/work-orders')
      .set(...bearer());
    expect(sup.body.items.map((w: { id: string }) => w.id)).toEqual(['w1']);
  });

  it('filters by project and status', async () => {
    const { app } = setup(adminVerifier, {
      workOrders: [
        workOrder({ id: 'w1', project: 'p1', status: 'pending' }),
        workOrder({ id: 'w2', project: 'p2', status: 'active', supervisorId: 'sup1' }),
      ],
    });
    const byProject = await request(app).get('/api/work-orders?project=p1').set(...bearer());
    expect(byProject.body.items.map((w: { id: string }) => w.id)).toEqual(['w1']);
    const byStatus = await request(app).get('/api/work-orders?status=active').set(...bearer());
    expect(byStatus.body.items.map((w: { id: string }) => w.id)).toEqual(['w2']);
  });
});

describe('GET /api/work-orders/:id', () => {
  it('lets the assigned supervisor read it but forbids others (403)', async () => {
    const opts = { workOrders: [workOrder({ id: 'w1', supervisorId: 'sup1', status: 'active' })] };
    const ok = await request(setup(supervisorVerifier('sup1'), opts).app)
      .get('/api/work-orders/w1')
      .set(...bearer());
    expect(ok.status).toBe(200);
    const no = await request(setup(supervisorVerifier('sup9'), opts).app)
      .get('/api/work-orders/w1')
      .set(...bearer());
    expect(no.status).toBe(403);
  });
});

describe('POST /api/work-orders/:id/assign', () => {
  it('assigns a supervisor and activates a pending work order', async () => {
    const { app } = setup(adminVerifier, {
      workOrders: [workOrder({ id: 'w1', status: 'pending' })],
      users: [supRecord('sup1')],
    });
    const res = await request(app)
      .post('/api/work-orders/w1/assign')
      .set(...bearer())
      .send({ supervisorId: 'sup1' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ supervisorId: 'sup1', status: 'active', supervisorName: 'sup1' });
  });

  it('rejects assigning an unknown supervisor (400)', async () => {
    const { app } = setup(adminVerifier, { workOrders: [workOrder({ id: 'w1' })], users: [] });
    const res = await request(app)
      .post('/api/work-orders/w1/assign')
      .set(...bearer())
      .send({ supervisorId: 'ghost' });
    expect(res.status).toBe(400);
  });

  it('reassigning moves requests to the new supervisor with statuses unchanged', async () => {
    const { app, materialRequestRepository } = setup(adminVerifier, {
      workOrders: [workOrder({ id: 'w1', supervisorId: 'sup1', status: 'active' })],
      users: [supRecord('sup1'), supRecord('sup2')],
      requests: [
        mr({ id: 'open', workOrder: 'w1', supervisorId: 'sup1', status: 'requested' }),
        mr({ id: 'proc', workOrder: 'w1', supervisorId: 'sup1', status: 'processing' }),
        mr({ id: 'acc', workOrder: 'w1', supervisorId: 'sup1', status: 'accepted' }),
      ],
    });

    const res = await request(app)
      .post('/api/work-orders/w1/assign')
      .set(...bearer())
      .send({ supervisorId: 'sup2' });
    expect(res.status).toBe(200);
    expect(res.body.supervisorId).toBe('sup2');

    const items = await materialRequestRepository.findByWorkOrder('w1');
    const byId = Object.fromEntries(items.map((i) => [i.id, i]));
    // All visibility moves to sup2, but every status is left exactly as it was.
    expect(byId['open'].supervisorId).toBe('sup2');
    expect(byId['proc'].supervisorId).toBe('sup2');
    expect(byId['acc'].supervisorId).toBe('sup2');
    expect(byId['open'].status).toBe('requested');
    expect(byId['proc'].status).toBe('processing');
    expect(byId['acc'].status).toBe('accepted');
  });

  it('409 when assigning a completed work order', async () => {
    const { app } = setup(adminVerifier, {
      workOrders: [workOrder({ id: 'w1', status: 'completed', supervisorId: 'sup1' })],
      users: [supRecord('sup2')],
    });
    const res = await request(app)
      .post('/api/work-orders/w1/assign')
      .set(...bearer())
      .send({ supervisorId: 'sup2' });
    expect(res.status).toBe(409);
  });

  it('forbids a supervisor from assigning (403)', async () => {
    const { app } = setup(supervisorVerifier('sup1'), {
      workOrders: [workOrder({ id: 'w1' })],
      users: [supRecord('sup1')],
    });
    const res = await request(app)
      .post('/api/work-orders/w1/assign')
      .set(...bearer())
      .send({ supervisorId: 'sup1' });
    expect(res.status).toBe(403);
  });
});

describe('POST /api/work-orders/:id/unassign', () => {
  it('reverts an active work order with no open items to pending', async () => {
    const { app } = setup(adminVerifier, {
      workOrders: [workOrder({ id: 'w1', supervisorId: 'sup1', status: 'active' })],
    });
    const res = await request(app).post('/api/work-orders/w1/unassign').set(...bearer());
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ supervisorId: null, status: 'pending' });
  });

  it('409 when the work order still has open items (reassign instead)', async () => {
    const { app } = setup(adminVerifier, {
      workOrders: [workOrder({ id: 'w1', supervisorId: 'sup1', status: 'active' })],
      requests: [mr({ id: 'acc', workOrder: 'w1', supervisorId: 'sup1', status: 'accepted' })],
    });
    const res = await request(app).post('/api/work-orders/w1/unassign').set(...bearer());
    expect(res.status).toBe(409);
  });

  it('drops terminal requests’ visibility (supervisorId null) on unassign', async () => {
    const { app, materialRequestRepository } = setup(adminVerifier, {
      workOrders: [workOrder({ id: 'w1', supervisorId: 'sup1', status: 'active' })],
      requests: [mr({ id: 'done', workOrder: 'w1', supervisorId: 'sup1', status: 'closed' })],
    });
    await request(app).post('/api/work-orders/w1/unassign').set(...bearer());

    const items = await materialRequestRepository.findByWorkOrder('w1');
    expect(items[0].supervisorId).toBeNull();
    expect(items[0].status).toBe('closed'); // terminal, unchanged
    // The ex-supervisor no longer sees it.
    expect((await materialRequestRepository.listBySupervisor('sup1')).items).toHaveLength(0);
  });

  it('409 when not active', async () => {
    const { app } = setup(adminVerifier, { workOrders: [workOrder({ id: 'w1', status: 'pending' })] });
    const res = await request(app).post('/api/work-orders/w1/unassign').set(...bearer());
    expect(res.status).toBe(409);
  });
});

describe('POST /api/work-orders/:id/complete', () => {
  it('completes an active work order with no open items', async () => {
    const { app } = setup(adminVerifier, {
      workOrders: [workOrder({ id: 'w1', supervisorId: 'sup1', status: 'active' })],
      requests: [mr({ id: 'r1', workOrder: 'w1', status: 'closed' })],
    });
    const res = await request(app).post('/api/work-orders/w1/complete').set(...bearer());
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('completed');
  });

  it('409 when an item is still open (accepted counts as open)', async () => {
    const { app } = setup(adminVerifier, {
      workOrders: [workOrder({ id: 'w1', supervisorId: 'sup1', status: 'active' })],
      requests: [mr({ id: 'r1', workOrder: 'w1', status: 'accepted' })],
    });
    const res = await request(app).post('/api/work-orders/w1/complete').set(...bearer());
    expect(res.status).toBe(409);
  });

  it('409 when the work order is not active', async () => {
    const { app } = setup(adminVerifier, { workOrders: [workOrder({ id: 'w1', status: 'pending' })] });
    const res = await request(app).post('/api/work-orders/w1/complete').set(...bearer());
    expect(res.status).toBe(409);
  });
});

describe('POST /api/work-orders/:id/cancel', () => {
  it('cancels a pending work order', async () => {
    const { app } = setup(adminVerifier, { workOrders: [workOrder({ id: 'w1', status: 'pending' })] });
    const res = await request(app).post('/api/work-orders/w1/cancel').set(...bearer());
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('cancelled');
  });

  it('409 when the work order is active (not pending)', async () => {
    const { app } = setup(adminVerifier, {
      workOrders: [workOrder({ id: 'w1', status: 'active', supervisorId: 'sup1' })],
    });
    const res = await request(app).post('/api/work-orders/w1/cancel').set(...bearer());
    expect(res.status).toBe(409);
  });
});

describe('work orders auth', () => {
  it('requires authentication (401)', async () => {
    const { app } = setup(adminVerifier, { workOrders: [workOrder()] });
    const res = await request(app).get('/api/work-orders');
    expect(res.status).toBe(401);
  });
});
