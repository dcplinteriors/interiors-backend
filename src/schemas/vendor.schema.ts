import { z } from 'zod';
import { nonEmptyString, paginationQuery } from './common';

export const createVendorSchema = z.object({
  name: nonEmptyString,
  // Optional, and not collected by the current UI — kept so they can be surfaced later.
  phone: z.string().trim().optional(),
  email: z.string().trim().email().optional(),
});

/** Edit a vendor / toggle its active state. Every field optional, at least one required.
 * `phone`/`email` accept `null` to clear. */
export const updateVendorSchema = z
  .object({
    name: nonEmptyString.optional(),
    phone: z.string().trim().nullable().optional(),
    email: z.string().trim().email().nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: 'No fields to update' });

export const listVendorsQuerySchema = z.object({ ...paginationQuery });
