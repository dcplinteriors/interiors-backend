import { z } from 'zod';
import { nonEmptyString, paginationQuery } from './common';

export const createSupervisorSchema = z.object({
  name: nonEmptyString,
  // Digits-ish only (allow separators an admin might type); `normalizePhone` does the real
  // validation in the service and rejects anything that isn't a 10-/12-digit Indian mobile.
  phone: z
    .string()
    .trim()
    .min(1)
    .max(20)
    .regex(/^[\d\s+()-]+$/, 'phone must contain only digits and separators'),
});

export const listSupervisorsQuerySchema = z.object({ ...paginationQuery });
