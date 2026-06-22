import { NumberingService } from '../../src/services/numbering/numberingService';
import { FakeCounterRepository } from '../fakes/fakeCounterRepository';

// Explicit UTC instants so FY assertions don't depend on the test machine's timezone.
const MAR_2027 = new Date('2027-03-15T00:00:00Z');
const APR_2026 = new Date('2026-04-15T00:00:00Z');
const APR_2027 = new Date('2027-04-15T00:00:00Z');

describe('NumberingService', () => {
  it('produces sequential project numbers within a financial year', async () => {
    const svc = new NumberingService(new FakeCounterRepository());
    expect(await svc.nextProjectNumber(APR_2026)).toBe('26-27_0001');
    expect(await svc.nextProjectNumber(APR_2026)).toBe('26-27_0002');
  });

  it('resets the project counter across the financial-year boundary (Mar → Apr)', async () => {
    const svc = new NumberingService(new FakeCounterRepository());
    expect(await svc.nextProjectNumber(MAR_2027)).toBe('26-27_0001'); // Mar 2027
    expect(await svc.nextProjectNumber(APR_2027)).toBe('27-28_0001'); // Apr 2027
  });

  it('numbers work orders per project — the counter resets per project', async () => {
    const svc = new NumberingService(new FakeCounterRepository());
    expect(await svc.nextWorkOrderNumber('projA', '26-27_0001')).toBe('26-27_0001/0001');
    expect(await svc.nextWorkOrderNumber('projA', '26-27_0001')).toBe('26-27_0001/0002');
    // A different project starts its own work-order sequence at 0001.
    expect(await svc.nextWorkOrderNumber('projB', '26-27_0002')).toBe('26-27_0002/0001');
  });

  it('reserves a contiguous block of work-order numbers in ONE counter call', async () => {
    const counters = new FakeCounterRepository();
    const svc = new NumberingService(counters);

    expect(await svc.nextWorkOrderNumbers('projA', '26-27_0001', 3)).toEqual([
      '26-27_0001/0001',
      '26-27_0001/0002',
      '26-27_0001/0003',
    ]);
    expect(counters.reserveCalls).toBe(1); // one transaction for the whole block, not 3

    // The next reservation continues the sequence (no gaps, no overlap).
    expect(await svc.nextWorkOrderNumbers('projA', '26-27_0001', 2)).toEqual([
      '26-27_0001/0004',
      '26-27_0001/0005',
    ]);
  });

  it('numbers items per work order in one reservation — the counter resets per work order', async () => {
    const counters = new FakeCounterRepository();
    const svc = new NumberingService(counters);

    expect(await svc.nextItemNumbers('woA', '26-27_0001/0001', 2)).toEqual([
      '26-27_0001/0001/0001',
      '26-27_0001/0001/0002',
    ]);
    expect(counters.reserveCalls).toBe(1);

    // Another work order has its own item sequence from 0001.
    expect(await svc.nextItemNumbers('woB', '26-27_0001/0002', 1)).toEqual([
      '26-27_0001/0002/0001',
    ]);
  });
});
