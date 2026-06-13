import { FirestoreProjectRepository } from '../../src/repositories/firestore/projectRepository';
import { clearFirestore } from './helpers';
import { CreateProjectInput } from '../../src/repositories/projectRepository';

const repo = new FirestoreProjectRepository();

const input = (over: Partial<CreateProjectInput> = {}): CreateProjectInput => ({
  particular: 'Lobby',
  clientName: 'Acme',
  date: '2025-06-10',
  po: 'PO_25-26_06/0001',
  supervisorId: null,
  status: 'active',
  createdAt: '2025-06-01T00:00:00.000Z',
  createdBy: 'admin1',
  ...over,
});

beforeEach(() => clearFirestore());

describe('FirestoreProjectRepository (emulator)', () => {
  it('assigns an id on create and reads it back', async () => {
    const created = await repo.create(input());
    expect(created.id).toBeTruthy();
    const found = await repo.findById(created.id);
    expect(found).toMatchObject({ id: created.id, particular: 'Lobby', po: 'PO_25-26_06/0001' });
  });

  it('finds projects for a set of supervisors, newest-first by createdAt', async () => {
    await repo.create(input({ supervisorId: 'sup1', createdAt: '2025-06-01T00:00:00.000Z', particular: 'older' }));
    await repo.create(input({ supervisorId: 'sup2', createdAt: '2025-06-05T00:00:00.000Z', particular: 'newer' }));
    await repo.create(input({ supervisorId: 'sup3', particular: 'unwanted' }));
    const found = await repo.findBySupervisorIds(['sup1', 'sup2']);
    expect(found.map((p) => p.particular)).toEqual(['newer', 'older']);
  });

  it('findBySupervisorIds returns [] for no ids', async () => {
    await repo.create(input({ supervisorId: 'sup1' }));
    expect(await repo.findBySupervisorIds([])).toEqual([]);
  });

  it('lists only a supervisor’s projects', async () => {
    await repo.create(input({ supervisorId: 'sup1' }));
    await repo.create(input({ supervisorId: 'sup2' }));
    const own = (await repo.listBySupervisor('sup1')).items;
    expect(own).toHaveLength(1);
    expect(own[0].supervisorId).toBe('sup1');
  });

  it('cursor-paginates the admin list newest-first', async () => {
    await repo.create(input({ createdAt: '2025-06-01T00:00:00.000Z', particular: 'a' }));
    await repo.create(input({ createdAt: '2025-06-02T00:00:00.000Z', particular: 'b' }));
    await repo.create(input({ createdAt: '2025-06-03T00:00:00.000Z', particular: 'c' }));

    const first = await repo.list({ limit: 2 });
    expect(first.items.map((p) => p.particular)).toEqual(['c', 'b']);
    expect(first.nextCursor).toBeTruthy();

    const second = await repo.list({ limit: 2, cursor: first.nextCursor! });
    expect(second.items.map((p) => p.particular)).toEqual(['a']);
    expect(second.nextCursor).toBeNull();
  });

  it('merges on update and returns the merged doc', async () => {
    const created = await repo.create(input());
    const updated = await repo.update(created.id, { supervisorId: 'sup9' });
    expect(updated).toMatchObject({ id: created.id, supervisorId: 'sup9', particular: 'Lobby' });
  });

  it('returns null when updating a missing project', async () => {
    expect(await repo.update('nope', { supervisorId: 'x' })).toBeNull();
  });
});
