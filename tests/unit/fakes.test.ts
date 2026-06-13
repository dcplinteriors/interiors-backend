import { FakeCounterRepository } from '../fakes/fakeCounterRepository';
import { FakeProjectRepository } from '../fakes/fakeProjectRepository';
import { FakeMaterialRequestRepository } from '../fakes/fakeMaterialRequestRepository';
import { CreateProjectInput } from '../../src/repositories/projectRepository';
import { CreateMaterialRequestInput } from '../../src/repositories/materialRequestRepository';

const projectInput = (over: Partial<CreateProjectInput> = {}): CreateProjectInput => ({
  particular: 'Lobby',
  clientName: 'Acme',
  date: '2025-06-01',
  po: 'PO_25-26_06/0001',
  supervisorId: null,
  status: 'active',
  createdAt: '2025-06-01T00:00:00.000Z',
  createdBy: 'admin1',
  ...over,
});

const mrInput = (over: Partial<CreateMaterialRequestInput> = {}): CreateMaterialRequestInput => ({
  project: 'proj_1',
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
  createdAt: '2025-06-01T00:00:00.000Z',
  ...over,
});

describe('FakeCounterRepository', () => {
  it('increments per (sequence, period) starting at 1', async () => {
    const c = new FakeCounterRepository();
    expect(await c.next('po', '25-26_06')).toBe(1);
    expect(await c.next('po', '25-26_06')).toBe(2);
    expect(await c.next('jb', '25-26_06')).toBe(1); // separate sequence
    expect(await c.next('po', '25-26_07')).toBe(1); // separate period
  });
});

describe('FakeProjectRepository', () => {
  it('creates with an id and finds by id', async () => {
    const repo = new FakeProjectRepository();
    const created = await repo.create(projectInput());
    expect(created.id).toBeTruthy();
    expect(await repo.findById(created.id)).toEqual(created);
  });

  it('lists by supervisor', async () => {
    const repo = new FakeProjectRepository();
    await repo.create(projectInput({ supervisorId: 'sup1' }));
    await repo.create(projectInput({ supervisorId: 'sup2' }));
    const own = (await repo.listBySupervisor('sup1')).items;
    expect(own).toHaveLength(1);
    expect(own[0].supervisorId).toBe('sup1');
  });
});

describe('FakeMaterialRequestRepository', () => {
  it('creates many and filters by status and supervisor', async () => {
    const repo = new FakeMaterialRequestRepository();
    await repo.createMany([mrInput(), mrInput({ status: 'accepted' })]);

    expect((await repo.list()).items).toHaveLength(2);
    expect((await repo.list({ status: 'requested' })).items).toHaveLength(1);
    expect((await repo.listBySupervisor('sup1')).items).toHaveLength(2);
    expect((await repo.listBySupervisor('other')).items).toHaveLength(0);
  });
});
