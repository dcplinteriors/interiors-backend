import { MaterialRequest, MaterialRequestStatus } from '../models/materialRequest';
import { Page } from '../utils/pagination';

export type CreateMaterialRequestInput = Omit<MaterialRequest, 'id'>;
export type MaterialRequestPatch = Partial<Omit<MaterialRequest, 'id'>>;

export interface MaterialRequestQuery {
  status?: MaterialRequestStatus;
  project?: string;
  workOrder?: string;
  /** Page size (clamped by the repo). */
  limit?: number;
  /** Opaque cursor from a previous page's `nextCursor`. */
  cursor?: string;
}

/** Filters shared by list + count (count ignores pagination). `statusIn` (count only) matches
 * any of several statuses in one query and takes precedence over `status` when present. */
export type MaterialRequestFilter = Pick<MaterialRequestQuery, 'status' | 'project' | 'workOrder'> & {
  statusIn?: MaterialRequestStatus[];
};

/** Persistence port for `materialRequests`. */
export interface MaterialRequestRepository {
  /** Persists several items (one form submission) and returns them with ids. */
  createMany(inputs: CreateMaterialRequestInput[]): Promise<MaterialRequest[]>;
  findById(id: string): Promise<MaterialRequest | null>;
  /** All items on a work order (unpaginated) — for the completion gate and the
   * reassignment supersede sweep. */
  findByWorkOrder(workOrderId: string): Promise<MaterialRequest[]>;
  list(query?: MaterialRequestQuery): Promise<Page<MaterialRequest>>;
  /** A supervisor's visible items — those on work orders CURRENTLY assigned to them
   * (keyed on the denormalized `supervisorId`, not `orderBy`). */
  listBySupervisor(
    supervisorId: string,
    query?: MaterialRequestQuery,
  ): Promise<Page<MaterialRequest>>;
  /** Count of all items matching [filter] (no pagination) — drives the admin review badge. */
  count(filter?: MaterialRequestFilter): Promise<number>;
  /** Count of a supervisor's visible items matching [filter]. */
  countBySupervisor(supervisorId: string, filter?: MaterialRequestFilter): Promise<number>;
  update(id: string, patch: MaterialRequestPatch): Promise<MaterialRequest | null>;
  /** Applies several patches, chunked to Firestore's 500-op batch limit (atomic per chunk). Used
   * for the work-order reassignment / unassign sweep. */
  updateMany(updates: { id: string; patch: MaterialRequestPatch }[]): Promise<void>;
  /** Atomically transitions one item in a Firestore transaction: reads it, applies `decide`
   * (which validates and returns a patch, or throws to abort), then writes — so the status check
   * and the write can't race. Returns the updated item, or `null` if it doesn't exist. */
  transition(
    id: string,
    decide: (current: MaterialRequest) => MaterialRequestPatch,
  ): Promise<MaterialRequest | null>;
}
