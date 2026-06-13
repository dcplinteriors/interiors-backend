import request from 'supertest';
import { adminVerifier, buildApp, bearer, supervisorVerifier } from '../helpers/testApp';
import { TokenVerifier } from '../../src/services/auth/tokenVerifier';
import { FakeMaterialRequestRepository } from '../fakes/fakeMaterialRequestRepository';
import { FakeProjectRepository } from '../fakes/fakeProjectRepository';
import { FakeCounterRepository } from '../fakes/fakeCounterRepository';
import { FakeUserRepository } from '../fakes/fakeUserRepository';
import { Project } from '../../src/models/project';
import { MaterialRequest } from '../../src/models/materialRequest';
import { UserRecord } from '../../src/models/user';

const project = (over: Partial<Project> = {}): Project => ({
  id: 'p1',
  particular: 'Lobby',
  clientName: 'Acme',
  date: '2025-06-10',
  po: 'PO_25-26_06/0001',
  supervisorId: 'sup1',
  status: 'active',
  createdAt: '2025-06-01T00:00:00.000Z',
  createdBy: 'admin1',
  ...over,
});

const mr = (over: Partial<MaterialRequest> = {}): MaterialRequest => ({
  id: 'mr1',
  project: 'p1',
  orderBy: 'sup1',
  poNumber: 'PO_25-26_06/0001',
  jobNumber: 'JB_25-26_06/0001',
  batchId: 'batch1',
  particular: 'Hinges',
  make: 'Hettich',
  size: '4 inch',
  quantity: 20,
  unit: 'PCS',
  attachments: { photos: [], audio: null },
  status: 'requested',
  createdAt: '2025-06-10T00:00:00.000Z',
  expectedDate: null,
  vendor: null,
  remarks: null,
  ...over,
});

const supervisorRecord = (uid: string, name: string): UserRecord => ({
  uid,
  role: 'supervisor',
  name,
  email: `${uid}@dcpl.test`,
  isActive: true,
  createdAt: '2025-06-01T00:00:00.000Z',
});

function setup(
  verifier: TokenVerifier,
  opts: { projects?: Project[]; requests?: MaterialRequest[]; users?: UserRecord[] } = {},
) {
  const materialRequestRepository = new FakeMaterialRequestRepository(opts.requests ?? []);
  const projectRepository = new FakeProjectRepository(opts.projects ?? []);
  const userRepository = new FakeUserRepository(opts.users ?? []);
  const counterRepository = new FakeCounterRepository();
  const app = buildApp({
    tokenVerifier: verifier,
    materialRequestRepository,
    projectRepository,
    userRepository,
    counterRepository,
  });
  return { app, materialRequestRepository };
}

describe('POST /api/material-requests (submit)', () => {
  it('creates one entry per item, with shared batchId, sequential Job numbers, inherited PO', async () => {
    const { app } = setup(supervisorVerifier('sup1'), { projects: [project()] });

    const res = await request(app)
      .post('/api/material-requests')
      .set(...bearer())
      .send({
        projectId: 'p1',
        items: [
          { particular: 'Hinges', make: 'Hettich', size: '4 inch', quantity: 20, unit: 'PCS' },
          { particular: 'Screws', make: 'GKW', size: 'M8', quantity: 2.5, unit: 'KG' },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveLength(2);
    const [a, b] = res.body;
    expect(a.poNumber).toBe('PO_25-26_06/0001');
    expect(b.poNumber).toBe('PO_25-26_06/0001');
    expect(a.jobNumber).toBe('JB_25-26_06/0001');
    expect(b.jobNumber).toBe('JB_25-26_06/0002');
    expect(a.batchId).toBe(b.batchId);
    expect(a.status).toBe('requested');
    expect(a.orderBy).toBe('sup1');
    expect(a.size).toBe('4 inch'); // per-item material size is persisted
    // Enriched so the client can show just-submitted rows without a refetch.
    expect(a.projectName).toBe('Lobby');
  });

  it('persists the supervisor’s own attachment paths', async () => {
    const { app } = setup(supervisorVerifier('sup1'), { projects: [project()] });
    const res = await request(app)
      .post('/api/material-requests')
      .set(...bearer())
      .send({
        projectId: 'p1',
        items: [
          {
            particular: 'Ply',
            make: 'Greenply',
            size: '12mm',
            quantity: 5,
            unit: 'SHEET',
            attachments: {
              photos: ['material-requests/sup1/a.jpg'],
              audio: 'material-requests/sup1/note.m4a',
            },
          },
        ],
      });
    expect(res.status).toBe(201);
    expect(res.body[0].attachments).toEqual({
      photos: ['material-requests/sup1/a.jpg'],
      audio: 'material-requests/sup1/note.m4a',
    });
  });

  it('rejects an attachment path the supervisor does not own (400, writes nothing)', async () => {
    const { app, materialRequestRepository } = setup(supervisorVerifier('sup1'), {
      projects: [project()],
    });
    const res = await request(app)
      .post('/api/material-requests')
      .set(...bearer())
      .send({
        projectId: 'p1',
        items: [
          {
            particular: 'Ply',
            make: 'Greenply',
            size: '12mm',
            quantity: 5,
            unit: 'SHEET',
            attachments: { photos: ['material-requests/sup2/stolen.jpg'] },
          },
        ],
      });
    expect(res.status).toBe(400);
    expect((await materialRequestRepository.list()).items).toHaveLength(0);
  });

  it('forbids submitting on a project the supervisor does not own (403, writes nothing)', async () => {
    const { app, materialRequestRepository } = setup(supervisorVerifier('sup1'), {
      projects: [project({ supervisorId: 'sup2' })],
    });
    const res = await request(app)
      .post('/api/material-requests')
      .set(...bearer())
      .send({ projectId: 'p1', items: [{ particular: 'X', make: 'Y', size: 'S', quantity: 1, unit: 'PCS' }] });
    expect(res.status).toBe(403);
    expect((await materialRequestRepository.list()).items).toHaveLength(0);
  });

  it('returns 404 for a missing project (writes nothing)', async () => {
    const { app, materialRequestRepository } = setup(supervisorVerifier('sup1'), { projects: [] });
    const res = await request(app)
      .post('/api/material-requests')
      .set(...bearer())
      .send({ projectId: 'nope', items: [{ particular: 'X', make: 'Y', size: 'S', quantity: 1, unit: 'PCS' }] });
    expect(res.status).toBe(404);
    expect((await materialRequestRepository.list()).items).toHaveLength(0);
  });

  it('forbids an admin from submitting (403)', async () => {
    const { app } = setup(adminVerifier, { projects: [project()] });
    const res = await request(app)
      .post('/api/material-requests')
      .set(...bearer())
      .send({ projectId: 'p1', items: [{ particular: 'X', make: 'Y', size: 'S', quantity: 1, unit: 'PCS' }] });
    expect(res.status).toBe(403);
  });

  it('rejects an empty item list (400)', async () => {
    const { app } = setup(supervisorVerifier('sup1'), { projects: [project()] });
    const res = await request(app)
      .post('/api/material-requests')
      .set(...bearer())
      .send({ projectId: 'p1', items: [] });
    expect(res.status).toBe(400);
  });

  it('rejects more than 3 photos (400)', async () => {
    const { app } = setup(supervisorVerifier('sup1'), { projects: [project()] });
    const res = await request(app)
      .post('/api/material-requests')
      .set(...bearer())
      .send({
        projectId: 'p1',
        items: [
          {
            particular: 'X',
            make: 'Y',
            size: 'S',
            quantity: 1,
            unit: 'PCS',
            attachments: { photos: ['a', 'b', 'c', 'd'] },
          },
        ],
      });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/material-requests (list)', () => {
  it('returns all for admin and supports status filter', async () => {
    const { app } = setup(adminVerifier, {
      requests: [mr({ id: 'mr1' }), mr({ id: 'mr2', status: 'accepted' })],
    });

    const all = await request(app).get('/api/material-requests').set(...bearer());
    expect(all.body.items).toHaveLength(2);
    expect(all.body.nextCursor).toBeNull();

    const requested = await request(app)
      .get('/api/material-requests?status=requested')
      .set(...bearer());
    expect(requested.body.items).toHaveLength(1);
  });

  it('paginates with limit + cursor (newest-first, no overlap)', async () => {
    const { app } = setup(adminVerifier, {
      requests: [
        mr({ id: 'mr1', createdAt: '2025-06-05T00:00:00.000Z' }),
        mr({ id: 'mr2', createdAt: '2025-06-04T00:00:00.000Z' }),
        mr({ id: 'mr3', createdAt: '2025-06-03T00:00:00.000Z' }),
      ],
    });

    const page1 = await request(app).get('/api/material-requests?limit=2').set(...bearer());
    expect(page1.body.items).toHaveLength(2);
    expect(page1.body.nextCursor).toBeTruthy();

    const page2 = await request(app)
      .get(`/api/material-requests?limit=2&cursor=${encodeURIComponent(page1.body.nextCursor)}`)
      .set(...bearer());
    expect(page2.body.items).toHaveLength(1);
    expect(page2.body.nextCursor).toBeNull();

    const ids = [...page1.body.items, ...page2.body.items].map((r: { id: string }) => r.id);
    expect(new Set(ids).size).toBe(3); // no duplicate rows across pages
  });

  it('pages cleanly across a batch boundary (rows sharing one createdAt)', async () => {
    // A multi-item submission gives every item the same createdAt — the id tiebreaker must
    // keep the cursor stable so no row is dropped or duplicated when a page splits the batch.
    const at = '2025-06-05T00:00:00.000Z';
    const { app } = setup(adminVerifier, {
      requests: [
        mr({ id: 'mrA', createdAt: at }),
        mr({ id: 'mrB', createdAt: at }),
        mr({ id: 'mrC', createdAt: at }),
      ],
    });

    const page1 = await request(app).get('/api/material-requests?limit=2').set(...bearer());
    const page2 = await request(app)
      .get(`/api/material-requests?limit=2&cursor=${encodeURIComponent(page1.body.nextCursor)}`)
      .set(...bearer());

    const ids = [...page1.body.items, ...page2.body.items].map((r: { id: string }) => r.id);
    expect(ids).toHaveLength(3);
    expect(new Set(ids)).toEqual(new Set(['mrA', 'mrB', 'mrC'])); // all present, none duplicated
    expect(page2.body.nextCursor).toBeNull();
  });

  it('returns only own requests for a supervisor', async () => {
    const { app } = setup(supervisorVerifier('sup1'), {
      requests: [mr({ id: 'mr1', orderBy: 'sup1' }), mr({ id: 'mr2', orderBy: 'sup2' })],
    });
    const res = await request(app).get('/api/material-requests').set(...bearer());
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].orderBy).toBe('sup1');
    expect(res.body.nextCursor).toBeNull();
  });

  it('paginates and status-filters a supervisor’s own requests (server-side)', async () => {
    const { app } = setup(supervisorVerifier('sup1'), {
      requests: [
        mr({ id: 'mr1', orderBy: 'sup1', status: 'requested', createdAt: '2025-06-01T00:00:00.000Z' }),
        mr({ id: 'mr2', orderBy: 'sup1', status: 'accepted', createdAt: '2025-06-02T00:00:00.000Z' }),
        mr({ id: 'mr3', orderBy: 'sup1', status: 'requested', createdAt: '2025-06-03T00:00:00.000Z' }),
        mr({ id: 'other', orderBy: 'sup2', status: 'requested', createdAt: '2025-06-04T00:00:00.000Z' }),
      ],
    });

    // Status filter is applied server-side, scoped to the caller.
    const requested = await request(app).get('/api/material-requests?status=requested').set(...bearer());
    expect(requested.body.items.map((r: { id: string }) => r.id)).toEqual(['mr3', 'mr1']);

    // Cursor pagination over the caller's own requests.
    const page1 = await request(app).get('/api/material-requests?limit=1').set(...bearer());
    expect(page1.body.items.map((r: { id: string }) => r.id)).toEqual(['mr3']);
    expect(page1.body.nextCursor).toBeTruthy();
    const page2 = await request(app)
      .get(`/api/material-requests?limit=1&cursor=${encodeURIComponent(page1.body.nextCursor)}`)
      .set(...bearer());
    expect(page2.body.items.map((r: { id: string }) => r.id)).toEqual(['mr2']);
  });

  it('resolves projectName + clientName (from project) and supervisorName (from orderBy)', async () => {
    const { app } = setup(adminVerifier, {
      requests: [mr({ id: 'mr1', project: 'p1', orderBy: 'sup1' })],
      projects: [project({ id: 'p1', particular: 'Lobby', clientName: 'Acme' })],
      users: [supervisorRecord('sup1', 'Ravi')],
    });
    const res = await request(app).get('/api/material-requests').set(...bearer());
    expect(res.body.items[0]).toMatchObject({
      projectName: 'Lobby',
      clientName: 'Acme',
      supervisorName: 'Ravi',
    });
  });

  it('falls back to null names when the refs are unknown', async () => {
    const { app } = setup(adminVerifier, { requests: [mr({ id: 'mr1' })] });
    const res = await request(app).get('/api/material-requests').set(...bearer());
    expect(res.body.items[0]).toMatchObject({
      projectName: null,
      clientName: null,
      supervisorName: null,
    });
  });
});

describe('POST /api/material-requests/:id/accept', () => {
  it('admin accepts a requested item with supply details', async () => {
    const { app } = setup(adminVerifier, { requests: [mr({ id: 'mr1' })] });
    const res = await request(app)
      .post('/api/material-requests/mr1/accept')
      .set(...bearer())
      .send({ expectedDate: '2025-06-20', vendor: 'Steel Co', remarks: 'urgent' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: 'accepted',
      expectedDate: '2025-06-20',
      vendor: 'Steel Co',
      remarks: 'urgent',
    });
  });

  it('accepts without remarks, storing remarks as null', async () => {
    const { app } = setup(adminVerifier, { requests: [mr({ id: 'mr1' })] });
    const res = await request(app)
      .post('/api/material-requests/mr1/accept')
      .set(...bearer())
      .send({ expectedDate: '2025-06-20', vendor: 'Steel Co' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('accepted');
    expect(res.body.remarks).toBeNull();
  });

  it('rejects accepting an already-decided request (409)', async () => {
    const { app } = setup(adminVerifier, { requests: [mr({ id: 'mr1', status: 'accepted' })] });
    const res = await request(app)
      .post('/api/material-requests/mr1/accept')
      .set(...bearer())
      .send({ expectedDate: '2025-06-20', vendor: 'Steel Co' });
    expect(res.status).toBe(409);
  });

  it('returns 404 for a missing request', async () => {
    const { app } = setup(adminVerifier, { requests: [] });
    const res = await request(app)
      .post('/api/material-requests/nope/accept')
      .set(...bearer())
      .send({ expectedDate: '2025-06-20', vendor: 'Steel Co' });
    expect(res.status).toBe(404);
  });

  it('forbids a supervisor from accepting (403)', async () => {
    const { app } = setup(supervisorVerifier('sup1'), { requests: [mr({ id: 'mr1' })] });
    const res = await request(app)
      .post('/api/material-requests/mr1/accept')
      .set(...bearer())
      .send({ expectedDate: '2025-06-20', vendor: 'Steel Co' });
    expect(res.status).toBe(403);
  });
});

describe('POST /api/material-requests/:id/decline', () => {
  it('admin declines a requested item with a reason', async () => {
    const { app } = setup(adminVerifier, { requests: [mr({ id: 'mr1' })] });
    const res = await request(app)
      .post('/api/material-requests/mr1/decline')
      .set(...bearer())
      .send({ remarks: 'out of budget' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'declined', remarks: 'out of budget' });
  });

  it('rejects declining a non-requested item (409)', async () => {
    const { app } = setup(adminVerifier, { requests: [mr({ id: 'mr1', status: 'cancelled' })] });
    const res = await request(app)
      .post('/api/material-requests/mr1/decline')
      .set(...bearer())
      .send({});
    expect(res.status).toBe(409);
  });
});

describe('POST /api/material-requests/:id/cancel', () => {
  it('lets the owning supervisor cancel a requested item, keeping the resolved names', async () => {
    const { app } = setup(supervisorVerifier('sup1'), {
      requests: [mr({ id: 'mr1', orderBy: 'sup1', project: 'p1' })],
      projects: [project({ id: 'p1', particular: 'Lobby' })],
    });
    const res = await request(app).post('/api/material-requests/mr1/cancel').set(...bearer());
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('cancelled');
    // Enriched so the optimistic in-place row update doesn't drop the project name.
    expect(res.body.projectName).toBe('Lobby');
  });

  it("forbids cancelling another supervisor's request (403)", async () => {
    const { app } = setup(supervisorVerifier('sup1'), { requests: [mr({ id: 'mr1', orderBy: 'sup2' })] });
    const res = await request(app).post('/api/material-requests/mr1/cancel').set(...bearer());
    expect(res.status).toBe(403);
  });

  it('rejects cancelling a non-requested item (409)', async () => {
    const { app } = setup(supervisorVerifier('sup1'), {
      requests: [mr({ id: 'mr1', orderBy: 'sup1', status: 'accepted' })],
    });
    const res = await request(app).post('/api/material-requests/mr1/cancel').set(...bearer());
    expect(res.status).toBe(409);
  });

  it('forbids an admin from cancelling (403)', async () => {
    const { app } = setup(adminVerifier, { requests: [mr({ id: 'mr1' })] });
    const res = await request(app).post('/api/material-requests/mr1/cancel').set(...bearer());
    expect(res.status).toBe(403);
  });
});

describe('material requests auth', () => {
  it('requires authentication (401)', async () => {
    const { app } = setup(adminVerifier);
    const res = await request(app).get('/api/material-requests');
    expect(res.status).toBe(401);
  });
});
