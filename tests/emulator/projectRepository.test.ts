import { FirestoreProjectRepository } from '../../src/repositories/firestore/projectRepository';
import { clearFirestore } from './helpers';
import { CreateProjectInput } from '../../src/repositories/projectRepository';

const repo = new FirestoreProjectRepository();

const input = (over: Partial<CreateProjectInput> = {}): CreateProjectInput => ({
  number: '26-27_0001',
  name: 'Lobby',
  clientName: 'Acme',
  projectEngineer: 'Eng',
  status: 'active',
  createdAt: '2026-06-01T00:00:00.000Z',
  createdBy: 'admin1',
  ...over,
});

beforeEach(() => clearFirestore());

describe('FirestoreProjectRepository (emulator)', () => {
  it('assigns an id on create and reads it back', async () => {
    const created = await repo.create(input());
    expect(created.id).toBeTruthy();
    const found = await repo.findById(created.id);
    expect(found).toMatchObject({ id: created.id, name: 'Lobby', number: '26-27_0001' });
  });

  it('batch-fetches by id (missing ids absent)', async () => {
    const a = await repo.create(input({ name: 'A' }));
    const b = await repo.create(input({ name: 'B' }));
    const found = await repo.findByIds([a.id, b.id, 'missing']);
    expect(found.map((p) => p.name).sort()).toEqual(['A', 'B']);
  });

  it('cursor-paginates the admin list newest-first', async () => {
    await repo.create(input({ createdAt: '2026-06-01T00:00:00.000Z', name: 'a' }));
    await repo.create(input({ createdAt: '2026-06-02T00:00:00.000Z', name: 'b' }));
    await repo.create(input({ createdAt: '2026-06-03T00:00:00.000Z', name: 'c' }));

    const first = await repo.list({ limit: 2 });
    expect(first.items.map((p) => p.name)).toEqual(['c', 'b']);
    expect(first.nextCursor).toBeTruthy();

    const second = await repo.list({ limit: 2, cursor: first.nextCursor! });
    expect(second.items.map((p) => p.name)).toEqual(['a']);
    expect(second.nextCursor).toBeNull();
  });

  it('merges on update and returns the merged doc', async () => {
    const created = await repo.create(input());
    const updated = await repo.update(created.id, { status: 'completed' });
    expect(updated).toMatchObject({ id: created.id, status: 'completed', name: 'Lobby' });
  });

  it('returns null when updating a missing project', async () => {
    expect(await repo.update('nope', { status: 'completed' })).toBeNull();
  });

  it('transition applies a decided patch atomically and aborts on throw', async () => {
    const created = await repo.create(input({ status: 'active' }));
    const updated = await repo.transition(created.id, () => ({ status: 'completed' }));
    expect(updated?.status).toBe('completed');

    await expect(
      repo.transition(created.id, () => {
        throw new Error('x');
      }),
    ).rejects.toThrow('x');
    expect((await repo.findById(created.id))?.status).toBe('completed'); // unchanged

    expect(await repo.transition('nope', () => ({ status: 'completed' }))).toBeNull();
  });
});
