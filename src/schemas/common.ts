import { z } from 'zod';

/** Shared request-validation primitives, reused across feature schemas. */
export const nonEmptyString = z.string().trim().min(1);
export const id = nonEmptyString;
export const isoDate = z.string().date(); // YYYY-MM-DD

/** Cursor-pagination query params shared by every paginated list endpoint. */
export const paginationQuery = {
  limit: z.coerce.number().int().positive().optional(),
  cursor: z.string().optional(),
};
