import { DocumentSnapshot, FieldPath, Query } from 'firebase-admin/firestore';
import { clampLimit, decodeCursor } from '../../utils/pagination';

/** Maps a Firestore document to a domain entity, using the doc id as the entity id. */
export function mapDoc<T>(doc: DocumentSnapshot): T {
  return { id: doc.id, ...doc.data() } as T;
}

/** Comparator for newest-first ordering by ISO `createdAt`. */
export function byCreatedAtDesc<T extends { createdAt: string }>(a: T, b: T): number {
  return b.createdAt.localeCompare(a.createdAt);
}

/**
 * Applies cursor pagination to a query: orders by `createdAt` desc with the document id as a
 * stable tiebreaker (rows in one batch share `createdAt`), fetches `limit + 1` (probe row),
 * and starts after the cursor. A query with filters needs a composite index over
 * (filters..., createdAt desc); the unfiltered case needs none (the automatic single-field
 * index covers it, and __name__ is sorted implicitly in the same desc direction). Pair with
 * `toPage` to slice off the probe + build nextCursor.
 */
export function paged(query: Query, limit?: number, cursor?: string): Query {
  let out = query
    .orderBy('createdAt', 'desc')
    .orderBy(FieldPath.documentId(), 'desc')
    .limit(clampLimit(limit) + 1);
  const c = decodeCursor(cursor);
  if (c) out = out.startAfter(c.createdAt, c.id);
  return out;
}
