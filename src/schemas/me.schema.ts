import { z } from 'zod';

/** PATCH /me body — a supervisor edits their own display name and/or profile image.
 * `photoUrl` may be null to clear it. */
export const updateMeSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    photoUrl: z.string().trim().min(1).nullable().optional(),
  })
  .refine((v) => v.name !== undefined || v.photoUrl !== undefined, {
    message: 'Provide at least one of name or photoUrl',
  });
