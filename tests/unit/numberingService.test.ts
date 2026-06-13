import { NumberingService } from '../../src/services/numbering/numberingService';
import { FakeCounterRepository } from '../fakes/fakeCounterRepository';

const JUNE_2025 = new Date(2025, 5, 1);
const JULY_2025 = new Date(2025, 6, 1);

describe('NumberingService', () => {
  it('produces sequential PO numbers within a month', async () => {
    const svc = new NumberingService(new FakeCounterRepository());
    expect(await svc.nextPoNumber(JUNE_2025)).toBe('PO_25-26_06/0001');
    expect(await svc.nextPoNumber(JUNE_2025)).toBe('PO_25-26_06/0002');
  });

  it('keeps PO and Job sequences independent', async () => {
    const svc = new NumberingService(new FakeCounterRepository());
    await svc.nextPoNumber(JUNE_2025); // PO 0001
    expect(await svc.nextJobNumber(JUNE_2025)).toBe('JB_25-26_06/0001');
  });

  it('nextJobNumbers reserves a contiguous block in ONE counter call', async () => {
    const counters = new FakeCounterRepository();
    const svc = new NumberingService(counters);

    const first = await svc.nextJobNumbers(JUNE_2025, 3);
    expect(first).toEqual(['JB_25-26_06/0001', 'JB_25-26_06/0002', 'JB_25-26_06/0003']);
    expect(counters.reserveCalls).toBe(1); // one transaction for the whole block, not 3

    // The next reservation continues the sequence (no gaps, no overlap).
    expect(await svc.nextJobNumbers(JUNE_2025, 2)).toEqual([
      'JB_25-26_06/0004',
      'JB_25-26_06/0005',
    ]);
  });

  it('resets the counter when the month changes', async () => {
    const svc = new NumberingService(new FakeCounterRepository());
    await svc.nextPoNumber(JUNE_2025); // 0001
    expect(await svc.nextPoNumber(JULY_2025)).toBe('PO_25-26_07/0001');
  });

  it('resets the counter across the financial-year boundary (Mar → Apr)', async () => {
    const svc = new NumberingService(new FakeCounterRepository());
    expect(await svc.nextPoNumber(new Date(2026, 2, 31))).toBe('PO_25-26_03/0001'); // Mar 2026
    expect(await svc.nextPoNumber(new Date(2026, 3, 1))).toBe('PO_26-27_04/0001'); // Apr 2026
  });
});
