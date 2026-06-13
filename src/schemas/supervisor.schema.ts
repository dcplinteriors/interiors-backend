import { z } from 'zod';
import { nonEmptyString, paginationQuery } from './common';

export const createSupervisorSchema = z.object({
  name: nonEmptyString,
  email: z.string().trim().email(),
  phone: nonEmptyString.optional(),
});

export const listSupervisorsQuerySchema = z.object({ ...paginationQuery });
