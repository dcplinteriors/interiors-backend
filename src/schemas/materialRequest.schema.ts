import { z } from 'zod';
import { id, isoDate, nonEmptyString, paginationQuery } from './common';

const attachmentsSchema = z
  .object({
    photos: z.array(z.string()).max(3).optional(),
    audio: z.string().nullable().optional(),
  })
  .optional();

const itemSchema = z.object({
  particular: nonEmptyString,
  make: nonEmptyString,
  size: nonEmptyString,
  quantity: z.number().positive(),
  unit: nonEmptyString,
  attachments: attachmentsSchema,
});

export const submitMaterialRequestSchema = z.object({
  projectId: id,
  // Capped to bound per-submission work (each item triggers a Job-number counter write).
  items: z.array(itemSchema).min(1).max(100),
});

export const acceptMaterialRequestSchema = z.object({
  expectedDate: isoDate,
  vendor: nonEmptyString,
  remarks: z.string().trim().optional(),
});

export const declineMaterialRequestSchema = z.object({
  remarks: z.string().trim().optional(),
});

export const listMaterialRequestQuerySchema = z.object({
  status: z.enum(['requested', 'accepted', 'declined', 'cancelled']).optional(),
  project: z.string().optional(),
  ...paginationQuery,
});
