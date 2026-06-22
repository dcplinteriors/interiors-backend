import { z } from 'zod';

/** Shared request-validation primitives, reused across feature schemas. */
// Upper-bounded so a single field can't approach the 1 MB Firestore-doc / body limit; 1000 chars
// is far above any real name / note / id while still rejecting abuse.
export const nonEmptyString = z.string().trim().min(1).max(1000);
export const id = nonEmptyString;
export const isoDate = z.string().date(); // YYYY-MM-DD

/** Cursor-pagination query params shared by every paginated list endpoint. */
export const paginationQuery = {
  limit: z.coerce.number().int().positive().optional(),
  cursor: z.string().optional(),
};
