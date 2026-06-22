/**
 * Hierarchical, financial-year-aware number formatting for Project → Work Order → Item.
 *
 *   Project     `FY_NNNN`                  e.g. `26-27_0001`        (counter resets per FY)
 *   Work order  `<projectNumber>/NNNN`     e.g. `26-27_0001/0001`   (resets per project)
 *   Item        `<workOrderNumber>/NNNN`   e.g. `26-27_0001/0001/0001` (resets per work order)
 *
 * FY is the Indian financial year (Apr–Mar), two digits each side, e.g. `26-27`.
 *
 * These functions are pure (format only). The counter values come from the transactional
 * Firestore counters in the data layer.
 */

const pad4 = (n: number): string => String(n).padStart(4, '0');
const twoDigits = (n: number): string => String(n % 100).padStart(2, '0');

// India Standard Time is UTC+5:30 with no DST, so a fixed offset is exact. We resolve the FY
// against IST wall-clock — NOT the server's local time — so a project created near the Apr-1
// boundary is filed correctly even when the host runs in UTC (e.g. Render).
const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

/** Indian financial year label for an instant, e.g. `26-27` (the FY starts in April, IST). */
export function financialYear(date: Date): string {
  const ist = new Date(date.getTime() + IST_OFFSET_MS);
  const monthNumber = ist.getUTCMonth() + 1; // 1–12, in IST
  const year = ist.getUTCFullYear();
  const startYear = monthNumber >= 4 ? year : year - 1; // FY starts in April
  return `${twoDigits(startYear)}-${twoDigits(startYear + 1)}`;
}

/** Project number `FY_NNNN`, e.g. `26-27_0001`. */
export function formatProjectNumber(date: Date, counter: number): string {
  return `${financialYear(date)}_${pad4(counter)}`;
}

/** Work-order number `<projectNumber>/NNNN`, e.g. `26-27_0001/0001`. */
export function formatWorkOrderNumber(projectNumber: string, counter: number): string {
  return `${projectNumber}/${pad4(counter)}`;
}

/** Item number `<workOrderNumber>/NNNN`, e.g. `26-27_0001/0001/0001`. */
export function formatItemNumber(workOrderNumber: string, counter: number): string {
  return `${workOrderNumber}/${pad4(counter)}`;
}
