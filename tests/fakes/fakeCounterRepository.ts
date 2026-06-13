import { CounterRepository } from '../../src/repositories/counterRepository';

export class FakeCounterRepository implements CounterRepository {
  private readonly counters = new Map<string, number>();
  /** How many times reserve() was called — lets tests assert a submission does ONE call. */
  reserveCalls = 0;

  next(sequence: string, periodKey: string): Promise<number> {
    return this.reserve(sequence, periodKey, 1);
  }

  async reserve(sequence: string, periodKey: string, count: number): Promise<number> {
    this.reserveCalls++;
    const key = `${sequence}:${periodKey}`;
    const current = this.counters.get(key) ?? 0;
    this.counters.set(key, current + count);
    return current + 1; // first value of the reserved block
  }
}
