import { clampLimit, decodeCursor, encodeCursor, Page } from '../../src/utils/pagination';

const defaultIdOf = <T>(item: T): string => (item as unknown as { id: string }).id;

/**
 * Builds a comparator mirroring the Firestore repos' ordering: `createdAt` desc, then document
 * id desc, compared by CODE UNIT (not `localeCompare`) so it matches Firestore's `__name__`
 * (UTF-8 byte) ordering. `idOf` selects the id (defaults to `row.id`). Must stay in lockstep
 * with `paginateSorted`'s slice predicate.
 */
export function byCreatedAtThenKeyDesc<T extends { createdAt: string }>(
  idOf: (item: T) => string = defaultIdOf,
) {
  return (a: T, b: T): number => {
    if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1;
    const ak = idOf(a);
    const bk = idOf(b);
    if (ak === bk) return 0;
    return ak < bk ? 1 : -1;
  };
}

/** The common case: entities whose id field is literally `id`. */
export const byCreatedAtThenIdDesc = byCreatedAtThenKeyDesc<{ id: string; createdAt: string }>();

/**
 * Slices an already newest-first-sorted list at the cursor and applies the limit, exactly
 * mirroring the Firestore repos (orderBy createdAt desc, __name__ desc + startAfter). Lets
 * fast tests validate real cursor behaviour, including shared-`createdAt` batch boundaries.
 * `idOf` selects the document id (defaults to `row.id`).
 */
export function paginateSorted<T extends { createdAt: string }>(
  sorted: T[],
  limit?: number,
  cursor?: string,
  idOf: (item: T) => string = defaultIdOf,
): Page<T> {
  const max = clampLimit(limit);
  const c = decodeCursor(cursor);
  const after = c
    ? sorted.filter(
        (r) => r.createdAt < c.createdAt || (r.createdAt === c.createdAt && idOf(r) < c.id),
      )
    : sorted;
  const items = after.slice(0, max);
  const last = items[items.length - 1];
  return {
    items,
    nextCursor:
      after.length > max && last
        ? encodeCursor({ createdAt: last.createdAt, id: idOf(last) })
        : null,
  };
}
