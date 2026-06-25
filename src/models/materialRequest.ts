export type MaterialRequestStatus =
  | 'requested'
  | 'processing'
  | 'accepted'
  | 'closed'
  | 'declined'
  | 'cancelled';

/** Storage references to uploaded files (the upload itself is the app's responsibility). */
export interface Attachments {
  /** Up to 3 photo paths. */
  photos: string[];
  /** Optional single audio clip path. */
  audio?: string | null;
}

/**
 * A single requested item under a work order. One material-request form submission creates
 * several of these (one per item) sharing a `batchId`. Each is acted on independently.
 */
export interface MaterialRequest {
  id: string;
  /** Generated per item at submit, e.g. `26-27_0001/0001/0001`. */
  itemNumber: string;
  /** Parent work order id. */
  workOrder: string;
  /** Parent project id (denormalized for filtering / scoping). */
  project: string;
  /** uid of the supervisor who raised the item — audit only; never changes. */
  orderBy: string;
  /**
   * uid of the work order's CURRENT assigned supervisor — the visibility key. Equals `orderBy`
   * at submit; updated if the work order is reassigned (so the new supervisor sees the item), and
   * set to `null` if the work order is unassigned (so nobody sees it). `orderBy` stays for audit.
   */
  supervisorId: string | null;
  /** Groups items submitted together in one form submission. */
  batchId: string;

  // User-entered, per item
  particular: string;
  make: string;
  /** Material size / dimension, e.g. "12mm", "8x4 ft". */
  size: string;
  quantity: number;
  unit: string;
  attachments: Attachments;

  status: MaterialRequestStatus;
  /** ISO timestamp. */
  createdAt: string;

  // Admin, when assigning the vendor (processing → accepted) / on decline
  expectedDate?: string | null;
  vendor?: string | null;
  /** Optional, plain manual PO reference the admin types when assigning the vendor. */
  poNumber?: string | null;
  /** Admin note — optional when assigning the vendor; REQUIRED as the decline reason. */
  remarks?: string | null;

  // Supervisor, on close
  /** Optional note the supervisor adds when closing the item. Kept separate from admin `remarks`. */
  closeNote?: string | null;
  /** Storage paths of the bill image(s) the supervisor attaches on close — at least one required. */
  billImages: string[];
}
