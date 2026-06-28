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
  workOrderId: id,
  // Capped to bound per-submission work (each item triggers an item-number counter write).
  items: z.array(itemSchema).min(1).max(100),
});

/** Accept (requested → processing): an optional note only. */
export const acceptMaterialRequestSchema = z.object({
  remarks: z.string().trim().optional(),
});

/** Assign vendor (processing → accepted): supply details. `vendorId` references a managed vendor
 * (the server snapshots its name onto the request); `poNumber` is optional manual text. */
export const assignVendorSchema = z.object({
  expectedDate: isoDate,
  vendorId: id,
  poNumber: z.string().trim().optional(),
  remarks: z.string().trim().optional(),
});

/** Decline: a reason is REQUIRED. */
export const declineMaterialRequestSchema = z.object({
  remarks: nonEmptyString,
});

/** Admin edit of the supervisor-entered item fields (to fix wrong entries). Every field is
 * optional, but at least one must be present. Only the item details — vendor/PO/etc. have their
 * own flows; status is never changed here. */
export const editMaterialRequestSchema = z
  .object({
    particular: nonEmptyString.optional(),
    make: nonEmptyString.optional(),
    size: nonEmptyString.optional(),
    quantity: z.number().positive().optional(),
    unit: nonEmptyString.optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: 'No fields to update' });

/** Max bill images a supervisor may attach when closing an item. Single knob — change freely. */
export const MAX_BILL_IMAGES = 3;

/** Close (accepted → closed): at least one bill image is REQUIRED; an optional note. */
export const closeMaterialRequestSchema = z.object({
  note: z.string().trim().optional(),
  billImages: z.array(nonEmptyString).min(1).max(MAX_BILL_IMAGES),
});

const MATERIAL_REQUEST_STATUSES = [
  'requested',
  'processing',
  'accepted',
  'closed',
  'declined',
  'cancelled',
] as const;

export const listMaterialRequestQuerySchema = z.object({
  status: z.enum(MATERIAL_REQUEST_STATUSES).optional(),
  workOrder: z.string().optional(),
  project: z.string().optional(),
  // Admin-only filter by the item's current supervisor (ignored on the supervisor's own list).
  supervisor: z.string().optional(),
  ...paginationQuery,
});

/** Count query — same filters as list, but no pagination (drives the review badge).
 * `statusIn` is a comma-separated list (e.g. `requested,processing`) for counting several
 * statuses in one call; when present it takes precedence over `status`. Capped at 10 to stay
 * within Firestore's `in` limit. */
export const countMaterialRequestQuerySchema = z.object({
  status: z.enum(MATERIAL_REQUEST_STATUSES).optional(),
  statusIn: z
    .string()
    .optional()
    .transform((s) => {
      const parts = s
        ?.split(',')
        .map((p) => p.trim())
        .filter(Boolean);
      return parts && parts.length > 0 ? parts : undefined;
    })
    .pipe(z.array(z.enum(MATERIAL_REQUEST_STATUSES)).max(10).optional()),
  workOrder: z.string().optional(),
  project: z.string().optional(),
});
