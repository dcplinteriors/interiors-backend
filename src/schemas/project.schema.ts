import { z } from 'zod';
import { id, isoDate, nonEmptyString, paginationQuery } from './common';

export const createProjectSchema = z.object({
  particular: nonEmptyString,
  clientName: nonEmptyString,
  date: isoDate,
});

export const assignSupervisorSchema = z.object({
  supervisorId: id,
});

export const listProjectsQuerySchema = z.object({ ...paginationQuery });
