export type MaterialRequestStatus = 'requested' | 'accepted' | 'declined' | 'cancelled';

/** Storage references to uploaded files (the upload itself is the app's responsibility). */
export interface Attachments {
  /** Up to 3 photo paths. */
  photos: string[];
  /** Optional single audio clip path. */
  audio?: string | null;
}

/**
 * A single requested item. One material-request form submission creates several of these
 * (one per item) sharing a `batchId`. Each is reviewed independently by an admin.
 */
export interface MaterialRequest {
  id: string;
  /** Project id this request belongs to. */
  project: string;
  /** Requesting supervisor's uid. */
  orderBy: string;
  /** Inherited from the project (= project.po). */
  poNumber: string;
  /** Generated per item, e.g. `JB_25-26_06/0001`. */
  jobNumber: string;
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

  // Admin, on acceptance
  expectedDate?: string | null;
  vendor?: string | null;
  remarks?: string | null;
}
