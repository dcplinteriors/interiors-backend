import { FirestoreMaterialRequestRepository } from '../../src/repositories/firestore/materialRequestRepository';
import { clearFirestore } from './helpers';
import { CreateMaterialRequestInput } from '../../src/repositories/materialRequestRepository';

const repo = new FirestoreMaterialRequestRepository();

const input = (over: Partial<CreateMaterialRequestInput> = {}): CreateMaterialRequestInput => ({
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

beforeEach(() => clearFirestore());

describe('FirestoreMaterialRequestRepository (emulator)', () => {
  it('creates many in a batch, each with a distinct id', async () => {
    const created = await repo.createMany([input({ particular: 'A' }), input({ particular: 'B' })]);
    expect(created).toHaveLength(2);
    expect(created[0].id).not.toBe(created[1].id);
    expect(await repo.findById(created[0].id)).toMatchObject({ particular: 'A' });
  });

  it('lists with status and project filters, newest-first', async () => {
    await repo.createMany([
      input({ project: 'p1', status: 'requested', createdAt: '2025-06-01T00:00:00.000Z' }),
      input({ project: 'p1', status: 'accepted', createdAt: '2025-06-05T00:00:00.000Z' }),
      input({ project: 'p2', status: 'requested', createdAt: '2025-06-03T00:00:00.000Z' }),
    ]);

    expect((await repo.list()).items).toHaveLength(3);
    expect((await repo.list({ status: 'requested' })).items).toHaveLength(2);
    expect((await repo.list({ project: 'p1' })).items).toHaveLength(2);
    expect((await repo.list({ project: 'p1', status: 'accepted' })).items).toHaveLength(1);

    const p1 = (await repo.list({ project: 'p1' })).items;
    expect(p1[0].createdAt > p1[1].createdAt).toBe(true); // newest-first
  });

  it('paginates with a cursor (newest-first, no overlap)', async () => {
    await repo.createMany([
      input({ createdAt: '2025-06-05T00:00:00.000Z' }),
      input({ createdAt: '2025-06-04T00:00:00.000Z' }),
      input({ createdAt: '2025-06-03T00:00:00.000Z' }),
    ]);

    const first = await repo.list({ limit: 2 });
    expect(first.items).toHaveLength(2);
    expect(first.nextCursor).not.toBeNull();

    const second = await repo.list({ limit: 2, cursor: first.nextCursor! });
    expect(second.items).toHaveLength(1);
    expect(second.nextCursor).toBeNull();

    const ids = [...first.items, ...second.items].map((r) => r.id);
    expect(new Set(ids).size).toBe(3); // no duplicates across pages
  });

  it('lists only a supervisor’s requests', async () => {
    await repo.createMany([input({ orderBy: 'sup1' }), input({ orderBy: 'sup2' })]);
    const own = await repo.listBySupervisor('sup1');
    expect(own.items).toHaveLength(1);
    expect(own.items[0].orderBy).toBe('sup1');
  });

  it('merges status + admin fields on update', async () => {
    const [created] = await repo.createMany([input()]);
    const updated = await repo.update(created.id, {
      status: 'accepted',
      vendor: 'Steel Co',
      expectedDate: '2025-06-20',
    });
    expect(updated).toMatchObject({
      id: created.id,
      status: 'accepted',
      vendor: 'Steel Co',
      particular: 'Hinges', // untouched field preserved by merge
    });
  });
});
