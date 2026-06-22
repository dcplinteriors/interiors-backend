import { WorkOrder, WorkOrderStatus } from '../models/workOrder';
import { Page } from '../utils/pagination';

export type CreateWorkOrderInput = Omit<WorkOrder, 'id'>;
export type WorkOrderPatch = Partial<Omit<WorkOrder, 'id'>>;

export interface WorkOrderQuery {
  project?: string;
  status?: WorkOrderStatus;
  /** Page size (clamped by the repo). */
  limit?: number;
  /** Opaque cursor from a previous page's `nextCursor`. */
  cursor?: string;
}

/** Persistence port for `workOrders`. */
export interface WorkOrderRepository {
  create(input: CreateWorkOrderInput): Promise<WorkOrder>;
  /** Persists several work orders (e.g. a project's initial set) and returns them with ids. */
  createMany(inputs: CreateWorkOrderInput[]): Promise<WorkOrder[]>;
  findById(id: string): Promise<WorkOrder | null>;
  /** Batch fetch by id (one round trip); missing ids are simply absent. */
  findByIds(ids: string[]): Promise<WorkOrder[]>;
  /** All work orders under a project (unpaginated) — for the project-completion gate. */
  findByProject(projectId: string): Promise<WorkOrder[]>;
  /** All work orders under any of [projectIds] (batched) — for list work-order counts. */
  findByProjectIds(projectIds: string[]): Promise<WorkOrder[]>;
  /** Work orders assigned to any of the given supervisors (batched), newest first. */
  findBySupervisorIds(supervisorIds: string[]): Promise<WorkOrder[]>;
  /** Admin list, cursor-paginated (newest first), with optional project/status filters. */
  list(query?: WorkOrderQuery): Promise<Page<WorkOrder>>;
  /** A supervisor's assigned work orders, cursor-paginated, with optional project/status filters. */
  listBySupervisor(supervisorId: string, query?: WorkOrderQuery): Promise<Page<WorkOrder>>;
  update(id: string, patch: WorkOrderPatch): Promise<WorkOrder | null>;
  /** Atomically transitions a work order in a Firestore transaction: reads it, applies `decide`
   * (which validates and returns a patch, or throws to abort), then writes — so the status check
   * and the write can't race. Returns the updated work order, or `null` if it doesn't exist. */
  transition(
    id: string,
    decide: (current: WorkOrder) => WorkOrderPatch,
  ): Promise<WorkOrder | null>;
}
