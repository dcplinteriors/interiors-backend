import {
  financialYear,
  monthSegment,
  periodKey,
  formatSequenceNumber,
  formatPoNumber,
  formatJobNumber,
} from '../../src/utils/numbering';

// Note: month is 0-indexed in the Date constructor (5 = June).

describe('financialYear (Indian FY, Apr–Mar)', () => {
  it('maps a date in/after April to YY-(YY+1)', () => {
    expect(financialYear(new Date(2025, 3, 1))).toBe('25-26'); // Apr 2025
    expect(financialYear(new Date(2025, 5, 15))).toBe('25-26'); // Jun 2025
    expect(financialYear(new Date(2025, 11, 31))).toBe('25-26'); // Dec 2025
  });

  it('maps a date before April to (YY-1)-YY', () => {
    expect(financialYear(new Date(2026, 0, 10))).toBe('25-26'); // Jan 2026
    expect(financialYear(new Date(2026, 2, 31))).toBe('25-26'); // Mar 2026
    expect(financialYear(new Date(2025, 2, 1))).toBe('24-25'); // Mar 2025
  });
});

describe('monthSegment', () => {
  it('zero-pads the month', () => {
    expect(monthSegment(new Date(2025, 5, 1))).toBe('06');
    expect(monthSegment(new Date(2025, 11, 1))).toBe('12');
  });
});

describe('periodKey', () => {
  it('combines financial year and month', () => {
    expect(periodKey(new Date(2025, 5, 1))).toBe('25-26_06');
    expect(periodKey(new Date(2026, 0, 1))).toBe('25-26_01');
  });
});

describe('PO / Job number formatting', () => {
  it('formats a PO number', () => {
    expect(formatPoNumber(new Date(2025, 5, 1), 1)).toBe('PO_25-26_06/0001');
  });

  it('formats a Job number', () => {
    expect(formatJobNumber(new Date(2025, 5, 1), 1)).toBe('JB_25-26_06/0001');
  });

  it('zero-pads the counter to 4 digits', () => {
    expect(formatSequenceNumber('PO', new Date(2025, 5, 1), 42)).toBe('PO_25-26_06/0042');
    expect(formatSequenceNumber('JB', new Date(2026, 0, 1), 1234)).toBe('JB_25-26_01/1234');
  });
});
