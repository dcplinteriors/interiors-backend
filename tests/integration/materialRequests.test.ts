import request from 'supertest';
import { adminVerifier, buildApp, bearer, supervisorVerifier } from '../helpers/testApp';
import { TokenVerifier } from '../../src/services/auth/tokenVerifier';
import { FakeMaterialRequestRepository } from '../fakes/fakeMaterialRequestRepository';
import { FakeProjectRepository } from '../fakes/fakeProjectRepository';
import { FakeWorkOrderRepository } from '../fakes/fakeWorkOrderRepository';
import { FakeUserRepository } from '../fakes/fakeUserRepository';
import { FakeCounterRepository } from '../fakes/fakeCounterRepository';
import { FakeStorageService } from '../fakes/fakeStorageService';
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
  supervisorId: 'sup1',
  status: 'active',
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

const supRecord = (uid: string, name = uid): UserRecord => ({
  uid,
  role: 'supervisor',
  name,
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
  const materialRequestRepository = new FakeMaterialRequestRepository(opts.requests ?? []);
  const projectRepository = new FakeProjectRepository(opts.projects ?? [project()]);
  const workOrderRepository = new FakeWorkOrderRepository(opts.workOrders ?? []);
  const userRepository = new FakeUserRepository(opts.users ?? []);
  const counterRepository = new FakeCounterRepository();
  const app = buildApp({
    tokenVerifier: verifier,
    materialRequestRepository,
    projectRepository,
    workOrderRepository,
    userRepository,
    counterRepository,
    storageService: new FakeStorageService(),
  });
  return { app, materialRequestRepository };
}

const item = (over = {}) => ({
  particular: 'Hinges',
  make: 'Hettich',
  size: '4 inch',
  quantity: 20,
  unit: 'PCS',
  ...over,
});

describe('POST /api/material-requests (submit)', () => {
  it('creates one entry per item under the work order, with item numbers + shared batchId', async () => {
    const { app } = setup(supervisorVerifier('sup1'), { workOrders: [workOrder()] });

    const res = await request(app)
      .post('/api/material-requests')
      .set(...bearer())
      .send({ workOrderId: 'wo1', items: [item(), item({ particular: 'Screws', unit: 'KG', quantity: 2.5 })] });

    expect(res.status).toBe(201);
    expect(res.body).toHaveLength(2);
    const [a, b] = res.body;
    expect(a.itemNumber).toBe('26-27_0001/0001/0001');
    expect(b.itemNumber).toBe('26-27_0001/0001/0002');
    expect(a.batchId).toBe(b.batchId);
    expect(a.status).toBe('requested');
    expect(a.orderBy).toBe('sup1');
    expect(a.supervisorId).toBe('sup1');
    expect(a.workOrder).toBe('wo1');
    expect(a.project).toBe('p1');
    // Enriched so the client shows just-submitted rows without a refetch.
    expect(a).toMatchObject({ workOrderName: 'WO A', projectName: 'Lobby', clientName: 'Acme' });
  });

  it('forbids submitting on a work order the supervisor is not assigned to (403, writes nothing)', async () => {
    const { app, materialRequestRepository } = setup(supervisorVerifier('sup1'), {
      workOrders: [workOrder({ supervisorId: 'sup2' })],
    });
    const res = await request(app)
      .post('/api/material-requests')
      .set(...bearer())
      .send({ workOrderId: 'wo1', items: [item()] });
    expect(res.status).toBe(403);
    expect((await materialRequestRepository.list()).items).toHaveLength(0);
  });

  it('404 for a missing work order', async () => {
    const { app } = setup(supervisorVerifier('sup1'), { workOrders: [] });
    const res = await request(app)
      .post('/api/material-requests')
      .set(...bearer())
      .send({ workOrderId: 'nope', items: [item()] });
    expect(res.status).toBe(404);
  });

  it('409 when the work order is completed', async () => {
    const { app } = setup(supervisorVerifier('sup1'), {
      workOrders: [workOrder({ status: 'completed' })],
    });
    const res = await request(app)
      .post('/api/material-requests')
      .set(...bearer())
      .send({ workOrderId: 'wo1', items: [item()] });
    expect(res.status).toBe(409);
  });

  it('409 when the parent project is completed', async () => {
    const { app } = setup(supervisorVerifier('sup1'), {
      projects: [project({ status: 'completed' })],
      workOrders: [workOrder()],
    });
    const res = await request(app)
      .post('/api/material-requests')
      .set(...bearer())
      .send({ workOrderId: 'wo1', items: [item()] });
    expect(res.status).toBe(409);
  });

  it('rejects a foreign attachment path (400, writes nothing)', async () => {
    const { app, materialRequestRepository } = setup(supervisorVerifier('sup1'), {
      workOrders: [workOrder()],
    });
    const res = await request(app)
      .post('/api/material-requests')
      .set(...bearer())
      .send({
        workOrderId: 'wo1',
        items: [item({ attachments: { photos: ['tmp/material-requests/sup2/stolen.jpg'] } })],
      });
    expect(res.status).toBe(400);
    expect((await materialRequestRepository.list()).items).toHaveLength(0);
  });

  it('rejects an empty item list (400) and forbids an admin (403)', async () => {
    const empty = await request(setup(supervisorVerifier('sup1'), { workOrders: [workOrder()] }).app)
      .post('/api/material-requests')
      .set(...bearer())
      .send({ workOrderId: 'wo1', items: [] });
    expect(empty.status).toBe(400);

    const admin = await request(setup(adminVerifier, { workOrders: [workOrder()] }).app)
      .post('/api/material-requests')
      .set(...bearer())
      .send({ workOrderId: 'wo1', items: [item()] });
    expect(admin.status).toBe(403);
  });
});

describe('GET /api/material-requests (list)', () => {
  it('returns all for admin with status + work-order filters; only visible ones for a supervisor', async () => {
    const opts = {
      requests: [
        mr({ id: 'mr1', workOrder: 'wo1', supervisorId: 'sup1', status: 'requested' }),
        mr({ id: 'mr2', workOrder: 'wo2', supervisorId: 'sup1', status: 'accepted' }),
        mr({ id: 'mr3', workOrder: 'wo1', supervisorId: 'sup2', status: 'requested' }),
      ],
    };
    const all = await request(setup(adminVerifier, opts).app)
      .get('/api/material-requests')
      .set(...bearer());
    expect(all.body.items).toHaveLength(3);

    const accepted = await request(setup(adminVerifier, opts).app)
      .get('/api/material-requests?status=accepted')
      .set(...bearer());
    expect(accepted.body.items.map((r: { id: string }) => r.id)).toEqual(['mr2']);

    const byWo = await request(setup(adminVerifier, opts).app)
      .get('/api/material-requests?workOrder=wo1')
      .set(...bearer());
    expect(byWo.body.items.map((r: { id: string }) => r.id).sort()).toEqual(['mr1', 'mr3']);

    // Supervisor sees only items whose CURRENT supervisorId is theirs.
    const mine = await request(setup(supervisorVerifier('sup1'), opts).app)
      .get('/api/material-requests')
      .set(...bearer());
    expect(mine.body.items.map((r: { id: string }) => r.id).sort()).toEqual(['mr1', 'mr2']);
  });

  it('resolves work-order/project/client/supervisor names', async () => {
    const { app } = setup(adminVerifier, {
      requests: [mr({ id: 'mr1' })],
      workOrders: [workOrder()],
      users: [supRecord('sup1', 'Ravi')],
    });
    const res = await request(app).get('/api/material-requests').set(...bearer());
    expect(res.body.items[0]).toMatchObject({
      workOrderName: 'WO A',
      workOrderNumber: '26-27_0001/0001',
      projectName: 'Lobby',
      clientName: 'Acme',
      supervisorName: 'Ravi',
    });
  });
});

describe('GET /api/material-requests/count', () => {
  const opts = {
    requests: [
      mr({ id: 'mr1', supervisorId: 'sup1', status: 'requested' }),
      mr({ id: 'mr2', supervisorId: 'sup1', status: 'accepted' }),
      mr({ id: 'mr3', supervisorId: 'sup2', status: 'requested' }),
    ],
  };

  it('admin counts all items matching the status filter', async () => {
    const res = await request(setup(adminVerifier, opts).app)
      .get('/api/material-requests/count?status=requested')
      .set(...bearer());
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ count: 2 });
  });

  it('with no filter counts everything', async () => {
    const res = await request(setup(adminVerifier, opts).app)
      .get('/api/material-requests/count')
      .set(...bearer());
    expect(res.body).toEqual({ count: 3 });
  });

  it('a supervisor counts only their own visible items', async () => {
    const res = await request(setup(supervisorVerifier('sup1'), opts).app)
      .get('/api/material-requests/count?status=requested')
      .set(...bearer());
    expect(res.body).toEqual({ count: 1 });
  });

  it('statusIn counts several statuses in one call', async () => {
    const res = await request(setup(adminVerifier, opts).app)
      .get('/api/material-requests/count?statusIn=requested,accepted')
      .set(...bearer());
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ count: 3 }); // mr1 + mr3 (requested) + mr2 (accepted)
  });

  it('statusIn takes precedence over status, and stays supervisor-scoped', async () => {
    const res = await request(setup(supervisorVerifier('sup1'), opts).app)
      .get('/api/material-requests/count?statusIn=requested,accepted&status=closed')
      .set(...bearer());
    expect(res.body).toEqual({ count: 2 }); // sup1's mr1 (requested) + mr2 (accepted)
  });

  it('rejects an invalid status in statusIn', async () => {
    const res = await request(setup(adminVerifier, opts).app)
      .get('/api/material-requests/count?statusIn=requested,bogus')
      .set(...bearer());
    expect(res.status).toBe(400);
  });
});

describe('admin acceptance flow (accept → assign-vendor)', () => {
  it('accept moves requested → processing', async () => {
    const { app } = setup(adminVerifier, { requests: [mr({ id: 'mr1', status: 'requested' })] });
    const res = await request(app).post('/api/material-requests/mr1/accept').set(...bearer()).send({});
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('processing');
  });

  it('assign-vendor moves processing → accepted with supply details', async () => {
    const { app } = setup(adminVerifier, { requests: [mr({ id: 'mr1', status: 'processing' })] });
    const res = await request(app)
      .post('/api/material-requests/mr1/assign-vendor')
      .set(...bearer())
      .send({ expectedDate: '2026-06-20', vendor: 'Steel Co', poNumber: 'PO-9', remarks: 'urgent' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: 'accepted',
      expectedDate: '2026-06-20',
      vendor: 'Steel Co',
      poNumber: 'PO-9',
      remarks: 'urgent',
    });
  });

  it('409 assigning a vendor before acceptance (still requested)', async () => {
    const { app } = setup(adminVerifier, { requests: [mr({ id: 'mr1', status: 'requested' })] });
    const res = await request(app)
      .post('/api/material-requests/mr1/assign-vendor')
      .set(...bearer())
      .send({ expectedDate: '2026-06-20', vendor: 'Steel Co' });
    expect(res.status).toBe(409);
  });

  it('409 accepting an already-processing item; 404 for a missing item; 403 for a supervisor', async () => {
    const dup = await request(setup(adminVerifier, { requests: [mr({ id: 'mr1', status: 'processing' })] }).app)
      .post('/api/material-requests/mr1/accept')
      .set(...bearer())
      .send({});
    expect(dup.status).toBe(409);

    const missing = await request(setup(adminVerifier, { requests: [] }).app)
      .post('/api/material-requests/nope/accept')
      .set(...bearer())
      .send({});
    expect(missing.status).toBe(404);

    const sup = await request(setup(supervisorVerifier('sup1'), { requests: [mr({ id: 'mr1' })] }).app)
      .post('/api/material-requests/mr1/accept')
      .set(...bearer())
      .send({});
    expect(sup.status).toBe(403);
  });
});

describe('POST /api/material-requests/:id/decline', () => {
  it('declines from requested or processing with a required reason', async () => {
    const fromRequested = await request(setup(adminVerifier, { requests: [mr({ id: 'mr1', status: 'requested' })] }).app)
      .post('/api/material-requests/mr1/decline')
      .set(...bearer())
      .send({ remarks: 'out of budget' });
    expect(fromRequested.body).toMatchObject({ status: 'declined', remarks: 'out of budget' });

    const fromProcessing = await request(setup(adminVerifier, { requests: [mr({ id: 'mr1', status: 'processing' })] }).app)
      .post('/api/material-requests/mr1/decline')
      .set(...bearer())
      .send({ remarks: 'no vendor' });
    expect(fromProcessing.body.status).toBe('declined');
  });

  it('400 when no reason is given', async () => {
    const { app } = setup(adminVerifier, { requests: [mr({ id: 'mr1' })] });
    const res = await request(app).post('/api/material-requests/mr1/decline').set(...bearer()).send({});
    expect(res.status).toBe(400);
  });
});

describe('PATCH /api/material-requests/:id (admin edits item details)', () => {
  it('edits the item fields while requested or processing', async () => {
    const fromRequested = await request(
      setup(adminVerifier, { requests: [mr({ id: 'mr1', status: 'requested' })] }).app,
    )
      .patch('/api/material-requests/mr1')
      .set(...bearer())
      .send({ make: 'Hettich Pro', quantity: 50, size: '6 inch' });
    expect(fromRequested.status).toBe(200);
    expect(fromRequested.body).toMatchObject({ make: 'Hettich Pro', quantity: 50, size: '6 inch' });

    const fromProcessing = await request(
      setup(adminVerifier, { requests: [mr({ id: 'mr1', status: 'processing' })] }).app,
    )
      .patch('/api/material-requests/mr1')
      .set(...bearer())
      .send({ particular: 'Corrected name' });
    expect(fromProcessing.status).toBe(200);
    expect(fromProcessing.body.particular).toBe('Corrected name');
  });

  it('409 once a vendor is assigned (accepted) or the item is terminal', async () => {
    for (const status of ['accepted', 'closed', 'declined', 'cancelled'] as const) {
      const res = await request(
        setup(adminVerifier, { requests: [mr({ id: 'mr1', status })] }).app,
      )
        .patch('/api/material-requests/mr1')
        .set(...bearer())
        .send({ make: 'X' });
      expect(res.status).toBe(409);
    }
  });

  it('400 on an empty patch, 404 for a missing item, 403 for a supervisor', async () => {
    const empty = await request(
      setup(adminVerifier, { requests: [mr({ id: 'mr1', status: 'requested' })] }).app,
    )
      .patch('/api/material-requests/mr1')
      .set(...bearer())
      .send({});
    expect(empty.status).toBe(400);

    const missing = await request(setup(adminVerifier, { requests: [] }).app)
      .patch('/api/material-requests/nope')
      .set(...bearer())
      .send({ make: 'X' });
    expect(missing.status).toBe(404);

    const sup = await request(
      setup(supervisorVerifier('sup1'), { requests: [mr({ id: 'mr1', status: 'requested' })] }).app,
    )
      .patch('/api/material-requests/mr1')
      .set(...bearer())
      .send({ make: 'X' });
    expect(sup.status).toBe(403);
  });
});

describe('supervisor transitions (cancel / close)', () => {
  it('cancel: owner cancels a requested item; 403 for a non-owner; 409 once not requested', async () => {
    const ok = await request(setup(supervisorVerifier('sup1'), { requests: [mr({ id: 'mr1', orderBy: 'sup1', status: 'requested' })], workOrders: [workOrder()] }).app)
      .post('/api/material-requests/mr1/cancel')
      .set(...bearer());
    expect(ok.body.status).toBe('cancelled');

    const other = await request(setup(supervisorVerifier('sup9'), { requests: [mr({ id: 'mr1', orderBy: 'sup1', supervisorId: 'sup9', status: 'requested' })] }).app)
      .post('/api/material-requests/mr1/cancel')
      .set(...bearer());
    expect(other.status).toBe(403); // not the owner (orderBy)

    const late = await request(setup(supervisorVerifier('sup1'), { requests: [mr({ id: 'mr1', orderBy: 'sup1', status: 'processing' })] }).app)
      .post('/api/material-requests/mr1/cancel')
      .set(...bearer());
    expect(late.status).toBe(409);
  });

  it('close: the assigned supervisor closes an accepted item with bill image(s) + optional note', async () => {
    const ok = await request(setup(supervisorVerifier('sup1'), { requests: [mr({ id: 'mr1', supervisorId: 'sup1', status: 'accepted' })], workOrders: [workOrder()] }).app)
      .post('/api/material-requests/mr1/close')
      .set(...bearer())
      // Submit staged bill paths; the server finalizes them to permanent keys on close.
      .send({ billImages: ['tmp/material-requests/sup1/bill.jpg'], note: 'paid cash' });
    expect(ok.body).toMatchObject({
      status: 'closed',
      billImages: ['material-requests/sup1/bill.jpg'],
      closeNote: 'paid cash',
    });

    const notAccepted = await request(setup(supervisorVerifier('sup1'), { requests: [mr({ id: 'mr1', supervisorId: 'sup1', status: 'requested' })] }).app)
      .post('/api/material-requests/mr1/close')
      .set(...bearer())
      .send({ billImages: ['tmp/material-requests/sup1/bill.jpg'] });
    expect(notAccepted.status).toBe(409);

    const notAssignee = await request(setup(supervisorVerifier('sup9'), { requests: [mr({ id: 'mr1', supervisorId: 'sup1', status: 'accepted' })] }).app)
      .post('/api/material-requests/mr1/close')
      .set(...bearer())
      .send({ billImages: ['tmp/material-requests/sup9/bill.jpg'] });
    expect(notAssignee.status).toBe(403);
  });

  it('close: rejects no bill image (400) and a foreign bill path (400)', async () => {
    const noBill = await request(setup(supervisorVerifier('sup1'), { requests: [mr({ id: 'mr1', supervisorId: 'sup1', status: 'accepted' })], workOrders: [workOrder()] }).app)
      .post('/api/material-requests/mr1/close')
      .set(...bearer())
      .send({ note: 'no bill attached' });
    expect(noBill.status).toBe(400);

    const foreign = await request(setup(supervisorVerifier('sup1'), { requests: [mr({ id: 'mr1', supervisorId: 'sup1', status: 'accepted' })], workOrders: [workOrder()] }).app)
      .post('/api/material-requests/mr1/close')
      .set(...bearer())
      .send({ billImages: ['material-requests/sup2/stolen.jpg'] });
    expect(foreign.status).toBe(400);
  });
});

describe('material requests auth', () => {
  it('requires authentication (401)', async () => {
    const { app } = setup(adminVerifier);
    const res = await request(app).get('/api/material-requests');
    expect(res.status).toBe(401);
  });
});
