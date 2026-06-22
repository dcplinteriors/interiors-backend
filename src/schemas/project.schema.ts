import { z } from 'zod';
import { isoDate, nonEmptyString, paginationQuery } from './common';

/** One work order in the create-project flow (the project is created with its work orders). */
export const workOrderInputSchema = z.object({
  name: nonEmptyString,
  date: isoDate,
  description: z.string().trim().optional(),
});

export const createProjectSchema = z.object({
  name: nonEmptyString,
  clientName: nonEmptyString,
  projectEngineer: nonEmptyString,
  // At least one work order; capped so the creation stays within one Firestore batch / counter
  // reservation. More can be added later via POST /projects/:id/work-orders.
  workOrders: z.array(workOrderInputSchema).min(1).max(50),
});

export const listProjectsQuerySchema = z.object({ ...paginationQuery });
