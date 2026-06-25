import { FakeCounterRepository } from '../fakes/fakeCounterRepository';
import { FakeProjectRepository } from '../fakes/fakeProjectRepository';
import { FakeWorkOrderRepository } from '../fakes/fakeWorkOrderRepository';
import { FakeMaterialRequestRepository } from '../fakes/fakeMaterialRequestRepository';
import { CreateProjectInput } from '../../src/repositories/projectRepository';
import { CreateWorkOrderInput } from '../../src/repositories/workOrderRepository';
import { CreateMaterialRequestInput } from '../../src/repositories/materialRequestRepository';

const projectInput = (over: Partial<CreateProjectInput> = {}): CreateProjectInput => ({
  number: '26-27_0001',
  name: 'Lobby',
  clientName: 'Acme',
  projectEngineer: 'Eng',
  status: 'active',
  createdAt: '2026-06-01T00:00:00.000Z',
  createdBy: 'admin1',
  ...over,
});

const workOrderInput = (over: Partial<CreateWorkOrderInput> = {}): CreateWorkOrderInput => ({
  project: 'proj_1',
  number: '26-27_0001/0001',
  name: 'WO A',
  date: '2026-06-01',
  description: null,
  supervisorId: null,
  status: 'pending',
  createdAt: '2026-06-01T00:00:00.000Z',
  createdBy: 'admin1',
  ...over,
});

const mrInput = (over: Partial<CreateMaterialRequestInput> = {}): CreateMaterialRequestInput => ({
  itemNumber: '26-27_0001/0001/0001',
  workOrder: 'wo_1',
  project: 'proj_1',
  orderBy: 'sup1',
  supervisorId: 'sup1',
  batchId: 'batch1',
  particular: 'Hinges',
  make: 'Hettich',
  size: '4 inch',
  quantity: 20,
  unit: 'PCS',
  attachments: { photos: [], audio: null },
  status: 'requested',
  createdAt: '2026-06-01T00:00:00.000Z',
  expectedDate: null,
  vendor: null,
  poNumber: null,
  remarks: null,
  billImages: [],
  ...over,
});

describe('FakeCounterRepository', () => {
  it('increments per (sequence, period) starting at 1', async () => {
    const c = new FakeCounterRepository();
    expect(await c.next('project', '26-27')).toBe(1);
    expect(await c.next('project', '26-27')).toBe(2);
    expect(await c.next('workOrder', 'proj_1')).toBe(1); // separate sequence
    expect(await c.next('project', '27-28')).toBe(1); // separate period
  });
});

describe('FakeProjectRepository', () => {
  it('creates with an id and finds by id', async () => {
    const repo = new FakeProjectRepository();
    const created = await repo.create(projectInput());
    expect(created.id).toBeTruthy();
    expect(await repo.findById(created.id)).toEqual(created);
  });

  it('lists newest-first', async () => {
    const repo = new FakeProjectRepository();
    await repo.create(projectInput({ createdAt: '2026-06-01T00:00:00.000Z' }));
    await repo.create(projectInput({ createdAt: '2026-06-02T00:00:00.000Z' }));
    const items = (await repo.list()).items;
    expect(items).toHaveLength(2);
    expect(items[0].createdAt > items[1].createdAt).toBe(true);
  });

  it('createWithWorkOrders persists the project and its work orders together', async () => {
    const workOrders = new FakeWorkOrderRepository();
    const repo = new FakeProjectRepository([], workOrders);

    const { project, workOrders: created } = await repo.createWithWorkOrders(
      projectInput(),
      async (projectId) => [
        workOrderInput({ project: projectId, name: 'Civil' }),
        workOrderInput({ project: projectId, name: 'Electrical' }),
      ],
    );

    expect(await repo.findById(project.id)).toEqual(project);
    expect(created).toHaveLength(2);
    expect((await workOrders.findByProject(project.id)).map((w) => w.name).sort()).toEqual([
      'Civil',
      'Electrical',
    ]);
  });

  it('createWithWorkOrders writes nothing if building the work orders fails (atomicity)', async () => {
    const workOrders = new FakeWorkOrderRepository();
    const repo = new FakeProjectRepository([], workOrders);

    await expect(
      repo.createWithWorkOrders(projectInput(), async () => {
        throw new Error('numbering failed'); // e.g. a counter write blew up
      }),
    ).rejects.toThrow('numbering failed');

    // No orphan: the project must not have been persisted without its work orders.
    expect((await repo.list()).items).toHaveLength(0);
    expect((await workOrders.findByProject('proj_1')).length).toBe(0);
  });
});

describe('FakeWorkOrderRepository', () => {
  it('finds by project and lists by supervisor', async () => {
    const repo = new FakeWorkOrderRepository();
    await repo.create(workOrderInput({ project: 'proj_1', supervisorId: 'sup1', status: 'active' }));
    await repo.create(workOrderInput({ project: 'proj_2', supervisorId: 'sup2', status: 'active' }));

    expect(await repo.findByProject('proj_1')).toHaveLength(1);
    expect(await repo.findBySupervisorIds(['sup1'])).toHaveLength(1);
    const own = (await repo.listBySupervisor('sup1')).items;
    expect(own).toHaveLength(1);
    expect(own[0].supervisorId).toBe('sup1');
  });
});

describe('FakeMaterialRequestRepository', () => {
  it('creates many and filters by status, work order, and supervisor', async () => {
    const repo = new FakeMaterialRequestRepository();
    await repo.createMany([mrInput(), mrInput({ status: 'accepted', workOrder: 'wo_2' })]);

    expect((await repo.list()).items).toHaveLength(2);
    expect((await repo.list({ status: 'requested' })).items).toHaveLength(1);
    expect((await repo.list({ workOrder: 'wo_2' })).items).toHaveLength(1);
    expect(await repo.findByWorkOrder('wo_1')).toHaveLength(1);
    expect((await repo.listBySupervisor('sup1')).items).toHaveLength(2);
    expect((await repo.listBySupervisor('other')).items).toHaveLength(0);
  });
});
