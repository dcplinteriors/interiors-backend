import { AppError } from '../../utils/AppError';
import { uniqueDefined } from '../../utils/collection';
import { Clock } from '../../utils/clock';
import { AuthUser } from '../../types/auth';
import { WorkOrder } from '../../models/workOrder';
import { MaterialRequestRepository } from '../../repositories/materialRequestRepository';
import { ProjectRepository } from '../../repositories/projectRepository';
import { UserRepository } from '../../repositories/userRepository';
import { WorkOrderQuery, WorkOrderRepository } from '../../repositories/workOrderRepository';
import { Page } from '../../utils/pagination';
import { WorkOrderView, toWorkOrderView } from '../../views/workOrderView';
import { NumberingService } from '../numbering/numberingService';
import { SUPERSEDABLE_STATUSES, isOpen } from '../materialRequest/materialRequest.stateMachine';
import {
  WORK_ORDER_TRANSITIONS,
  WorkOrderAction,
  isWorkOrderTerminal,
} from './workOrder.stateMachine';

export interface AddWorkOrderInput {
  name: string;
  date: string;
  description?: string;
  createdBy: string;
}

export interface WorkOrderServiceDeps {
  workOrderRepository: WorkOrderRepository;
  projectRepository: ProjectRepository;
  materialRequestRepository: MaterialRequestRepository;
  userRepository: UserRepository;
  numberingService: NumberingService;
  clock: Clock;
}

export class WorkOrderService {
  constructor(private readonly deps: WorkOrderServiceDeps) {}

  /** Admins see all work orders; supervisors see only those assigned to them. Each row carries
   * its project's name/number + client name and the assigned supervisor's name. */
  async listForUser(auth: AuthUser, query: WorkOrderQuery = {}): Promise<Page<WorkOrderView>> {
    const page =
      auth.role === 'admin'
        ? await this.deps.workOrderRepository.list(query)
        : await this.deps.workOrderRepository.listBySupervisor(auth.uid, query);
    return { items: await this.enrich(page.items), nextCursor: page.nextCursor };
  }

  async getForUser(id: string, auth: AuthUser): Promise<WorkOrderView> {
    const workOrder = await this.findOr404(id);
    if (auth.role === 'supervisor' && workOrder.supervisorId !== auth.uid) {
      throw new AppError(403, 'Forbidden');
    }
    return (await this.enrich([workOrder]))[0];
  }

  /** Adds a work order to an existing project, generating its number. */
  async addToProject(projectId: string, input: AddWorkOrderInput): Promise<WorkOrderView> {
    const project = await this.deps.projectRepository.findById(projectId);
    if (!project) throw new AppError(404, 'Project not found');
    if (project.status === 'completed') throw new AppError(409, 'Project is completed');

    const number = await this.deps.numberingService.nextWorkOrderNumber(project.id, project.number);
    const created = await this.deps.workOrderRepository.create({
      project: project.id,
      number,
      name: input.name,
      date: input.date,
      description: input.description ?? null,
      supervisorId: null,
      status: 'pending',
      createdAt: this.deps.clock().toISOString(),
      createdBy: input.createdBy,
    });
    return (await this.enrich([created]))[0];
  }

  /**
   * Assigns a supervisor to a work order (admin). First assignment goes pending → active.
   * Re-assigning to a DIFFERENT supervisor moves the work order and ALL its requests to the new
   * supervisor (the old one loses visibility) and supersedes any still vendor-pending item.
   */
  async assign(workOrderId: string, supervisorId: string): Promise<WorkOrderView> {
    const user = await this.deps.userRepository.findByUid(supervisorId);
    if (!user || user.role !== 'supervisor') {
      throw new AppError(400, 'Supervisor not found');
    }
    const workOrder = await this.findOr404(workOrderId);
    if (isWorkOrderTerminal(workOrder.status)) {
      throw new AppError(409, `Cannot assign a ${workOrder.status} work order`);
    }
    // Already assigned to this supervisor → idempotent no-op (no sweep, no rewrite).
    if (workOrder.supervisorId === supervisorId) {
      return (await this.enrich([workOrder]))[0];
    }
    // Reassignment from a different supervisor: move the requests before flipping the WO.
    if (workOrder.supervisorId) {
      await this.reassignRequests(workOrderId, supervisorId);
    }

    const updated = await this.deps.workOrderRepository.transition(workOrderId, (wo) => {
      if (isWorkOrderTerminal(wo.status)) {
        throw new AppError(409, `Cannot assign a ${wo.status} work order`);
      }
      return { supervisorId, status: 'active' };
    });
    if (!updated) throw new AppError(404, 'Work order not found');
    return (await this.enrich([updated]))[0];
  }

  /**
   * Unassigns a work order (admin), reverting active → pending. Allowed only when it has NO open
   * items — open items would be stranded with no supervisor to act on them (and `accepted` ones
   * would block completion forever); to move active work, **reassign** to another supervisor
   * instead. Terminal requests have their visibility dropped so the ex-supervisor stops seeing them.
   */
  async unassign(workOrderId: string): Promise<WorkOrderView> {
    const items = await this.deps.materialRequestRepository.findByWorkOrder(workOrderId);
    if (items.some((i) => isOpen(i.status))) {
      throw new AppError(409, 'Cannot unassign a work order with open items — reassign it instead');
    }
    const updated = await this.deps.workOrderRepository.transition(workOrderId, (wo) => {
      if (wo.status !== 'active') {
        throw new AppError(409, `Cannot unassign a ${wo.status} work order`);
      }
      return { supervisorId: null, status: 'pending' };
    });
    if (!updated) throw new AppError(404, 'Work order not found');
    if (items.length > 0) {
      await this.deps.materialRequestRepository.updateMany(
        items.map((i) => ({ id: i.id, patch: { supervisorId: null } })),
      );
    }
    return (await this.enrich([updated]))[0];
  }

  /** Completes a work order (admin) — gated on no item still open (requested/processing/accepted). */
  async complete(workOrderId: string): Promise<WorkOrderView> {
    // The open-items gate is read before the transaction; the WO's own status is re-checked
    // atomically with the write, so two admins can't double-complete. The narrow submit-vs-complete
    // window (a brand-new item arriving after this read) is accepted — the stray item stays workable.
    const items = await this.deps.materialRequestRepository.findByWorkOrder(workOrderId);
    const hasOpenItems = items.some((i) => isOpen(i.status));
    const updated = await this.deps.workOrderRepository.transition(workOrderId, (wo) => {
      this.assertStatusTransition(wo.status, 'complete');
      if (hasOpenItems) throw new AppError(409, 'Work order has open items');
      return { status: 'completed' };
    });
    if (!updated) throw new AppError(404, 'Work order not found');
    return (await this.enrich([updated]))[0];
  }

  /** Cancels a still-pending (unassigned) work order (admin). */
  async cancel(workOrderId: string): Promise<WorkOrderView> {
    const updated = await this.deps.workOrderRepository.transition(workOrderId, (wo) => {
      this.assertStatusTransition(wo.status, 'cancel');
      return { status: 'cancelled' };
    });
    if (!updated) throw new AppError(404, 'Work order not found');
    return (await this.enrich([updated]))[0];
  }

  private assertStatusTransition(current: WorkOrder['status'], action: WorkOrderAction): void {
    if (!WORK_ORDER_TRANSITIONS[action].from.includes(current)) {
      throw new AppError(409, `Cannot ${action} a ${current} work order`);
    }
  }

  /**
   * Moves every request on a REASSIGNED work order to the new supervisor, superseding the still
   * vendor-pending ones; `accepted` and already-terminal items carry over with their status intact
   * (the new supervisor can close/return the accepted ones). Applied as one batched sweep (chunked
   * to Firestore's 500-op limit; atomic per chunk).
   *
   * NOTE: this is a bulk cross-aggregate operation, so it deliberately bypasses the per-item
   * `transition()` funnel — `SUPERSEDABLE_STATUSES` (from the state machine) is the shared guard
   * for which items get superseded.
   */
  private async reassignRequests(workOrderId: string, newSupervisorId: string): Promise<void> {
    const requests = await this.deps.materialRequestRepository.findByWorkOrder(workOrderId);
    if (requests.length === 0) return;
    const updates = requests.map((r) => ({
      id: r.id,
      patch: {
        supervisorId: newSupervisorId,
        ...(SUPERSEDABLE_STATUSES.includes(r.status) ? { status: 'superseded' as const } : {}),
      },
    }));
    await this.deps.materialRequestRepository.updateMany(updates);
  }

  private async findOr404(id: string): Promise<WorkOrder> {
    const workOrder = await this.deps.workOrderRepository.findById(id);
    if (!workOrder) throw new AppError(404, 'Work order not found');
    return workOrder;
  }

  /** Resolves each work order's project (name/number/client) + supervisor name via batch lookups. */
  private async enrich(workOrders: WorkOrder[]): Promise<WorkOrderView[]> {
    if (workOrders.length === 0) return [];
    const projectIds = uniqueDefined(workOrders.map((w) => w.project));
    const supervisorIds = uniqueDefined(workOrders.map((w) => w.supervisorId));
    const [projects, supervisors] = await Promise.all([
      this.deps.projectRepository.findByIds(projectIds),
      this.deps.userRepository.findByUids(supervisorIds),
    ]);
    const projectsById = new Map(projects.map((p) => [p.id, p]));
    const supervisorNames = new Map(supervisors.map((s) => [s.uid, s.name]));
    return workOrders.map((w) => toWorkOrderView(w, projectsById, supervisorNames));
  }
}
