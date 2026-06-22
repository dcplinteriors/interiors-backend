import { FirestoreWorkOrderRepository } from '../../src/repositories/firestore/workOrderRepository';
import { clearFirestore } from './helpers';
import { CreateWorkOrderInput } from '../../src/repositories/workOrderRepository';

const repo = new FirestoreWorkOrderRepository();

const input = (over: Partial<CreateWorkOrderInput> = {}): CreateWorkOrderInput => ({
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

beforeEach(() => clearFirestore());

describe('FirestoreWorkOrderRepository (emulator)', () => {
  it('creates one and many, reads back by id', async () => {
    const one = await repo.create(input({ name: 'solo' }));
    expect(one.id).toBeTruthy();
    const many = await repo.createMany([input({ name: 'A' }), input({ name: 'B' })]);
    expect(many).toHaveLength(2);
    expect(await repo.findById(one.id)).toMatchObject({ name: 'solo' });
  });

  it('finds all work orders under a project, newest-first', async () => {
    await repo.create(input({ project: 'p1', name: 'older', createdAt: '2026-06-01T00:00:00.000Z' }));
    await repo.create(input({ project: 'p1', name: 'newer', createdAt: '2026-06-05T00:00:00.000Z' }));
    await repo.create(input({ project: 'p2', name: 'other' }));
    expect((await repo.findByProject('p1')).map((w) => w.name)).toEqual(['newer', 'older']);
  });

  it('finds by project ids and supervisor ids (batched)', async () => {
    await repo.create(input({ project: 'p1', supervisorId: 'sup1', status: 'active' }));
    await repo.create(input({ project: 'p2', supervisorId: 'sup2', status: 'active' }));
    expect(await repo.findByProjectIds(['p1', 'p2'])).toHaveLength(2);
    expect(await repo.findByProjectIds([])).toEqual([]);
    const bySup = await repo.findBySupervisorIds(['sup1']);
    expect(bySup).toHaveLength(1);
    expect(bySup[0].supervisorId).toBe('sup1');
  });

  it('lists with project/status filters and lists by supervisor', async () => {
    await repo.create(input({ project: 'p1', status: 'pending' }));
    await repo.create(input({ project: 'p1', status: 'active', supervisorId: 'sup1' }));
    expect((await repo.list({ project: 'p1' })).items).toHaveLength(2);
    expect((await repo.list({ status: 'active' })).items).toHaveLength(1);
    const own = (await repo.listBySupervisor('sup1')).items;
    expect(own).toHaveLength(1);
    expect(own[0].supervisorId).toBe('sup1');
  });

  it('transition applies a decided patch atomically and aborts on throw', async () => {
    const created = await repo.create(input({ status: 'pending' }));
    const updated = await repo.transition(created.id, () => ({ status: 'cancelled' }));
    expect(updated?.status).toBe('cancelled');

    await expect(
      repo.transition(created.id, () => {
        throw new Error('x');
      }),
    ).rejects.toThrow('x');
    expect((await repo.findById(created.id))?.status).toBe('cancelled'); // unchanged

    expect(await repo.transition('nope', () => ({ status: 'completed' }))).toBeNull();
  });

  it('merges on update and returns null for a missing work order', async () => {
    const created = await repo.create(input());
    const updated = await repo.update(created.id, { supervisorId: 'sup9', status: 'active' });
    expect(updated).toMatchObject({
      id: created.id,
      supervisorId: 'sup9',
      status: 'active',
      name: 'WO A',
    });
    expect(await repo.update('nope', { status: 'cancelled' })).toBeNull();
  });
});
