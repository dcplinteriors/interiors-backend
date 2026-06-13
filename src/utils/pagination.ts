/** A page of results plus an opaque cursor for the next page (null = no more). */
export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

/** The sort key a cursor points at — collections are ordered by `createdAt` desc, with the
 * document id as a tiebreaker (items in one submission batch share `createdAt`). */
export interface Cursor {
  createdAt: string;
  id: string;
}

/** Common pagination params accepted by paginated list queries. */
export interface PageQuery {
  limit?: number;
  cursor?: string;
}

export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 100;

/** Clamp a requested page size into [1, MAX]; default when missing/invalid. */
export function clampLimit(limit?: number): number {
  if (!limit || limit < 1) return DEFAULT_PAGE_SIZE;
  return Math.min(Math.floor(limit), MAX_PAGE_SIZE);
}

export function encodeCursor(cursor: Cursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString('base64url');
}

/**
 * Builds a Page from `limit + 1` fetched, already-ordered rows: the extra "probe" row (if
 * present) signals there's a next page, and nextCursor is taken from the LAST RETURNED row.
 * `idOf` extracts the document id for the cursor — defaults to `row.id`, override for
 * entities keyed differently (e.g. users, whose id field is `uid`).
 */
export function toPage<T extends { createdAt: string }>(
  docs: T[],
  limit: number,
  idOf: (item: T) => string = (item) => (item as unknown as { id: string }).id,
): Page<T> {
  const items = docs.slice(0, limit);
  const last = items[items.length - 1];
  return {
    items,
    nextCursor:
      docs.length > limit && last
        ? encodeCursor({ createdAt: last.createdAt, id: idOf(last) })
        : null,
  };
}

/** Decodes a cursor; returns null for missing or malformed input (treated as "first page"). */
export function decodeCursor(raw: string | undefined): Cursor | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
    if (parsed && typeof parsed.createdAt === 'string' && typeof parsed.id === 'string') {
      return { createdAt: parsed.createdAt, id: parsed.id };
    }
    return null;
  } catch {
    return null;
  }
}
