import { FirestoreCounterRepository } from '../../src/repositories/firestore/counterRepository';
import { clearFirestore } from './helpers';

const repo = new FirestoreCounterRepository();

beforeEach(() => clearFirestore());

describe('FirestoreCounterRepository (emulator)', () => {
  it('starts at 1 and increments per (sequence, period)', async () => {
    expect(await repo.next('po', '25-26_06')).toBe(1);
    expect(await repo.next('po', '25-26_06')).toBe(2);
  });

  it('keeps sequences and periods independent', async () => {
    await repo.next('po', '25-26_06');
    expect(await repo.next('jb', '25-26_06')).toBe(1);
    expect(await repo.next('po', '25-26_07')).toBe(1);
  });

  it('increments atomically under concurrent calls (no lost updates)', async () => {
    const results = await Promise.all(
      Array.from({ length: 20 }, () => repo.next('po', '25-26_06')),
    );
    // All 20 values must be the distinct set 1..20 — proving the transaction serialized them.
    expect([...results].sort((a, b) => a - b)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
  });
});
