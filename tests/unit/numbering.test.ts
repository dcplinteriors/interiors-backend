import {
  financialYear,
  formatProjectNumber,
  formatWorkOrderNumber,
  formatItemNumber,
} from '../../src/utils/numbering';

// Dates are given as explicit UTC instants so the assertions are independent of the machine's
// timezone — the FY is resolved against IST wall-clock inside `financialYear`.

describe('financialYear (Indian FY, Apr–Mar, IST)', () => {
  it('maps a date in/after April to YY-(YY+1)', () => {
    expect(financialYear(new Date('2026-04-15T00:00:00Z'))).toBe('26-27'); // Apr 2026
    expect(financialYear(new Date('2026-06-15T00:00:00Z'))).toBe('26-27'); // Jun 2026
    expect(financialYear(new Date('2026-12-31T00:00:00Z'))).toBe('26-27'); // Dec 2026
  });

  it('maps a date before April to (YY-1)-YY', () => {
    expect(financialYear(new Date('2027-01-10T00:00:00Z'))).toBe('26-27'); // Jan 2027
    expect(financialYear(new Date('2027-03-15T00:00:00Z'))).toBe('26-27'); // Mar 2027
    expect(financialYear(new Date('2026-03-15T00:00:00Z'))).toBe('25-26'); // Mar 2026
  });

  it('resolves the Apr-1 boundary in IST, not the server timezone', () => {
    // 2026-03-31T18:30Z == 2026-04-01 00:00 IST → the new FY begins.
    expect(financialYear(new Date('2026-03-31T18:30:00Z'))).toBe('26-27');
    // One minute earlier is still 2026-03-31 23:59 IST → the old FY.
    expect(financialYear(new Date('2026-03-31T18:29:00Z'))).toBe('25-26');
  });
});

describe('hierarchical number formatting', () => {
  const apr2026 = new Date('2026-04-15T00:00:00Z');

  it('formats a project number: FY_NNNN', () => {
    expect(formatProjectNumber(apr2026, 1)).toBe('26-27_0001');
    expect(formatProjectNumber(apr2026, 42)).toBe('26-27_0042');
  });

  it('formats a work-order number: <projectNumber>/NNNN', () => {
    expect(formatWorkOrderNumber('26-27_0001', 1)).toBe('26-27_0001/0001');
    expect(formatWorkOrderNumber('26-27_0001', 12)).toBe('26-27_0001/0012');
  });

  it('formats an item number: <workOrderNumber>/NNNN', () => {
    expect(formatItemNumber('26-27_0001/0001', 1)).toBe('26-27_0001/0001/0001');
    expect(formatItemNumber('26-27_0001/0002', 305)).toBe('26-27_0001/0002/0305');
  });
});
