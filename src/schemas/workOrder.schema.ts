import { z } from 'zod';
import { id, isoDate, nonEmptyString, paginationQuery } from './common';

/** Body for POST /projects/:id/work-orders (add a work order to an existing project). */
export const createWorkOrderSchema = z.object({
  name: nonEmptyString,
  date: isoDate,
  description: z.string().trim().optional(),
});

export const assignWorkOrderSchema = z.object({
  supervisorId: id,
});

export const listWorkOrderQuerySchema = z.object({
  project: z.string().optional(),
  status: z.enum(['pending', 'active', 'completed', 'cancelled']).optional(),
  ...paginationQuery,
});
