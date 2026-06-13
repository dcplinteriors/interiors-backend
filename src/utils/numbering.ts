/**
 * PO and Job number formatting.
 *
 * Format: `PREFIX_FY_MM/XXXX`
 *   FY   — Indian financial year (Apr–Mar), two digits each side, e.g. `25-26`
 *   MM   — two-digit month, e.g. `06`
 *   XXXX — zero-padded 4-digit counter (reset monthly; supplied by the caller)
 *
 * Example: formatJobNumber(new Date(2025, 5, 1), 1) === 'JB_25-26_06/0001'
 *
 * These functions are pure (format only). The monthly counter value comes from a
 * transactional Firestore counter in the data layer.
 */

const PO_PREFIX = 'PO';
const JOB_PREFIX = 'JB';

const twoDigits = (n: number): string => String(n % 100).padStart(2, '0');

/** Indian financial year label for a date, e.g. `25-26`. */
export function financialYear(date: Date): string {
  const monthNumber = date.getMonth() + 1; // 1–12
  const year = date.getFullYear();
  const startYear = monthNumber >= 4 ? year : year - 1; // FY starts in April
  return `${twoDigits(startYear)}-${twoDigits(startYear + 1)}`;
}

/** Two-digit month segment for a date, e.g. `06`. */
export function monthSegment(date: Date): string {
  return String(date.getMonth() + 1).padStart(2, '0');
}

/** Counter namespace for a date — counters reset per (financial year + month), e.g. `25-26_06`. */
export function periodKey(date: Date): string {
  return `${financialYear(date)}_${monthSegment(date)}`;
}

export function formatSequenceNumber(prefix: string, date: Date, counter: number): string {
  return `${prefix}_${financialYear(date)}_${monthSegment(date)}/${String(counter).padStart(4, '0')}`;
}

export const formatPoNumber = (date: Date, counter: number): string =>
  formatSequenceNumber(PO_PREFIX, date, counter);

export const formatJobNumber = (date: Date, counter: number): string =>
  formatSequenceNumber(JOB_PREFIX, date, counter);
