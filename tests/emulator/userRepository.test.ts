import { FirestoreUserRepository } from '../../src/repositories/firestore/userRepository';
import { clearFirestore } from './helpers';
import { UserRecord } from '../../src/models/user';

const repo = new FirestoreUserRepository();

const user = (over: Partial<UserRecord> = {}): UserRecord => ({
  uid: 'u1',
  role: 'supervisor',
  name: 'S',
  email: 's@dcpl.test',
  isActive: true,
  createdAt: '2025-06-01T00:00:00.000Z',
  ...over,
});

beforeEach(() => clearFirestore());

describe('FirestoreUserRepository (emulator)', () => {
  it('creates and reads back by uid', async () => {
    await repo.create(user());
    expect(await repo.findByUid('u1')).toMatchObject({ uid: 'u1', email: 's@dcpl.test' });
  });

  it('findByEmail is case-sensitive (exact match)', async () => {
    await repo.create(user({ email: 's@dcpl.test' }));
    expect(await repo.findByEmail('s@dcpl.test')).not.toBeNull();
    expect(await repo.findByEmail('S@DCPL.test')).toBeNull();
  });

  it('lists by role', async () => {
    await repo.create(user({ uid: 'u1', email: 'a@dcpl.test', role: 'supervisor' }));
    await repo.create(user({ uid: 'u2', email: 'b@dcpl.test', role: 'admin' }));
    const supervisors = await repo.listByRole('supervisor');
    expect(supervisors.items).toHaveLength(1);
    expect(supervisors.items[0].uid).toBe('u1');
  });

  it('cursor-paginates by role, newest-first, exposing nextCursor', async () => {
    await repo.create(user({ uid: 'u1', email: 'a@dcpl.test', role: 'supervisor', createdAt: '2025-06-01T00:00:00.000Z' }));
    await repo.create(user({ uid: 'u2', email: 'b@dcpl.test', role: 'supervisor', createdAt: '2025-06-02T00:00:00.000Z' }));
    await repo.create(user({ uid: 'u3', email: 'c@dcpl.test', role: 'supervisor', createdAt: '2025-06-03T00:00:00.000Z' }));

    const first = await repo.listByRole('supervisor', { limit: 2 });
    expect(first.items.map((u) => u.uid)).toEqual(['u3', 'u2']);
    expect(first.nextCursor).toBeTruthy();

    const second = await repo.listByRole('supervisor', { limit: 2, cursor: first.nextCursor! });
    expect(second.items.map((u) => u.uid)).toEqual(['u1']);
    expect(second.nextCursor).toBeNull();
  });

  it('persists a record with an undefined optional field (the phone crash regression)', async () => {
    // Before ignoreUndefinedProperties, Firestore .set() threw on `phone: undefined`.
    await expect(repo.create(user({ phone: undefined }))).resolves.toBeDefined();
    expect(await repo.findByUid('u1')).not.toBeNull();
  });
});
