import { FirestoreMaterialRequestRepository } from '../../src/repositories/firestore/materialRequestRepository';
import { clearFirestore } from './helpers';
import { CreateMaterialRequestInput } from '../../src/repositories/materialRequestRepository';

const repo = new FirestoreMaterialRequestRepository();

const input = (over: Partial<CreateMaterialRequestInput> = {}): CreateMaterialRequestInput => ({
  itemNumber: '26-27_0001/0001/0001',
  workOrder: 'wo1',
  project: 'p1',
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
  createdAt: '2026-06-10T00:00:00.000Z',
  expectedDate: null,
  vendor: null,
  poNumber: null,
  remarks: null,
  billImages: [],
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

  it('lists with status, project, and work-order filters, newest-first', async () => {
    await repo.createMany([
      input({ workOrder: 'wo1', project: 'p1', status: 'requested', createdAt: '2026-06-01T00:00:00.000Z' }),
      input({ workOrder: 'wo1', project: 'p1', status: 'accepted', createdAt: '2026-06-05T00:00:00.000Z' }),
      input({ workOrder: 'wo2', project: 'p2', status: 'requested', createdAt: '2026-06-03T00:00:00.000Z' }),
    ]);

    expect((await repo.list()).items).toHaveLength(3);
    expect((await repo.list({ status: 'requested' })).items).toHaveLength(2);
    expect((await repo.list({ project: 'p1' })).items).toHaveLength(2);
    expect((await repo.list({ workOrder: 'wo1' })).items).toHaveLength(2);
    expect((await repo.list({ workOrder: 'wo1', status: 'accepted' })).items).toHaveLength(1);

    const wo1 = (await repo.list({ workOrder: 'wo1' })).items;
    expect(wo1[0].createdAt > wo1[1].createdAt).toBe(true); // newest-first
  });

  it('counts with filters, and scopes by supervisor', async () => {
    await repo.createMany([
      input({ supervisorId: 'sup1', status: 'requested' }),
      input({ supervisorId: 'sup1', status: 'accepted' }),
      input({ supervisorId: 'sup2', status: 'requested' }),
    ]);

    expect(await repo.count()).toBe(3);
    expect(await repo.count({ status: 'requested' })).toBe(2);
    expect(await repo.count({ statusIn: ['requested', 'accepted'] })).toBe(3);
    expect(await repo.countBySupervisor('sup1')).toBe(2);
    expect(await repo.countBySupervisor('sup1', { status: 'requested' })).toBe(1);
    expect(
      await repo.countBySupervisor('sup1', { statusIn: ['requested', 'accepted'] }),
    ).toBe(2);
  });

  it('finds all items on a work order', async () => {
    await repo.createMany([
      input({ workOrder: 'wo1' }),
      input({ workOrder: 'wo1' }),
      input({ workOrder: 'wo2' }),
    ]);
    expect(await repo.findByWorkOrder('wo1')).toHaveLength(2);
  });

  it('paginates with a cursor (newest-first, no overlap)', async () => {
    await repo.createMany([
      input({ createdAt: '2026-06-05T00:00:00.000Z' }),
      input({ createdAt: '2026-06-04T00:00:00.000Z' }),
      input({ createdAt: '2026-06-03T00:00:00.000Z' }),
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

  it('lists only a supervisor’s visible requests (by current supervisorId)', async () => {
    await repo.createMany([input({ supervisorId: 'sup1' }), input({ supervisorId: 'sup2' })]);
    const own = await repo.listBySupervisor('sup1');
    expect(own.items).toHaveLength(1);
    expect(own.items[0].supervisorId).toBe('sup1');
  });

  it(
    'updateMany applies more than the 500-op batch limit (chunked)',
    async () => {
      const inputs = Array.from({ length: 520 }, () => input({ workOrder: 'big' }));
      // Seed in <=500 chunks (createMany is itself a single batch).
      await repo.createMany(inputs.slice(0, 260));
      await repo.createMany(inputs.slice(260));
      const before = await repo.findByWorkOrder('big');
      expect(before).toHaveLength(520);

      await repo.updateMany(before.map((r) => ({ id: r.id, patch: { supervisorId: 'newSup' } })));

      const after = await repo.findByWorkOrder('big');
      expect(after).toHaveLength(520);
      expect(after.every((r) => r.supervisorId === 'newSup')).toBe(true);
    },
    30000,
  );

  it('transition reads/decides/writes atomically and aborts cleanly on a thrown decision', async () => {
    const [created] = await repo.createMany([input({ status: 'requested' })]);

    const updated = await repo.transition(created.id, (cur) => {
      expect(cur.status).toBe('requested');
      return { status: 'processing' };
    });
    expect(updated?.status).toBe('processing');

    // A decision that throws aborts the transaction — nothing is written.
    await expect(
      repo.transition(created.id, () => {
        throw new Error('nope');
      }),
    ).rejects.toThrow('nope');
    expect((await repo.findById(created.id))?.status).toBe('processing'); // unchanged

    expect(await repo.transition('missing', () => ({ status: 'closed' }))).toBeNull();
  });

  it('serializes two concurrent transitions on the same item — exactly one wins', async () => {
    const [created] = await repo.createMany([input({ status: 'requested' })]);

    // Both try to leave `requested`; the transaction that loses the race re-reads the new status
    // and its from-check throws, so only one commits.
    const fromRequested = (to: 'processing' | 'declined') =>
      repo.transition(created.id, (cur) => {
        if (cur.status !== 'requested') throw new Error(`already ${cur.status}`);
        return { status: to };
      });

    const results = await Promise.allSettled([fromRequested('processing'), fromRequested('declined')]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
    expect(['processing', 'declined']).toContain((await repo.findById(created.id))?.status);
  });

  it('merges status + admin fields on update', async () => {
    const [created] = await repo.createMany([input()]);
    const updated = await repo.update(created.id, {
      status: 'accepted',
      vendor: 'Steel Co',
      expectedDate: '2026-06-20',
    });
    expect(updated).toMatchObject({
      id: created.id,
      status: 'accepted',
      vendor: 'Steel Co',
      particular: 'Hinges', // untouched field preserved by merge
    });
  });
});
