import { FirestoreCounterRepository } from '../../src/repositories/firestore/counterRepository';
import { clearFirestore } from './helpers';

const repo = new FirestoreCounterRepository();

beforeEach(() => clearFirestore());

describe('FirestoreCounterRepository (emulator)', () => {
  it('starts at 1 and increments per (sequence, period)', async () => {
    expect(await repo.next('project', '26-27')).toBe(1);
    expect(await repo.next('project', '26-27')).toBe(2);
  });

  it('keeps sequences and periods independent', async () => {
    await repo.next('project', '26-27');
    expect(await repo.next('workOrder', 'proj1')).toBe(1); // separate sequence
    expect(await repo.next('project', '27-28')).toBe(1); // separate period
  });

  it(
    'increments atomically under concurrent calls (no lost updates)',
    async () => {
      const results = await Promise.all(
        Array.from({ length: 20 }, () => repo.next('item', 'wo1')),
      );
      // All 20 values must be the distinct set 1..20 — proving the transaction serialized them.
      expect([...results].sort((a, b) => a - b)).toEqual(
        Array.from({ length: 20 }, (_, i) => i + 1),
      );
    },
    // 20-way contention on one counter doc serializes via transaction retries — give the
    // emulator headroom beyond Jest's 5s default so a slow machine doesn't flake.
    20000,
  );
});
