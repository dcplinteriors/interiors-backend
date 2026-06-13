import { MaterialRequest, MaterialRequestStatus } from '../models/materialRequest';
import { Page } from '../utils/pagination';

export type CreateMaterialRequestInput = Omit<MaterialRequest, 'id'>;
export type MaterialRequestPatch = Partial<Omit<MaterialRequest, 'id'>>;

export interface MaterialRequestQuery {
  status?: MaterialRequestStatus;
  project?: string;
  /** Page size (clamped by the repo). */
  limit?: number;
  /** Opaque cursor from a previous page's `nextCursor`. */
  cursor?: string;
}

/** Persistence port for `materialRequests`. */
export interface MaterialRequestRepository {
  /** Persists several items (one form submission) and returns them with ids. */
  createMany(inputs: CreateMaterialRequestInput[]): Promise<MaterialRequest[]>;
  findById(id: string): Promise<MaterialRequest | null>;
  list(query?: MaterialRequestQuery): Promise<Page<MaterialRequest>>;
  listBySupervisor(
    supervisorId: string,
    query?: MaterialRequestQuery,
  ): Promise<Page<MaterialRequest>>;
  update(id: string, patch: MaterialRequestPatch): Promise<MaterialRequest | null>;
}
