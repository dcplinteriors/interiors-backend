import { randomUUID } from 'node:crypto';
import { AppError } from '../../utils/AppError';
import { isOwnAttachmentPath } from '../../utils/attachmentPath';
import { uniqueDefined } from '../../utils/collection';
import { Page } from '../../utils/pagination';
import { Clock } from '../../utils/clock';
import { AuthUser } from '../../types/auth';
import { MaterialRequest } from '../../models/materialRequest';
import {
  CreateMaterialRequestInput,
  MaterialRequestFilter,
  MaterialRequestPatch,
  MaterialRequestQuery,
  MaterialRequestRepository,
} from '../../repositories/materialRequestRepository';
import { ProjectRepository } from '../../repositories/projectRepository';
import { WorkOrderRepository } from '../../repositories/workOrderRepository';
import { UserRepository } from '../../repositories/userRepository';
import { MaterialRequestView, toMaterialRequestView } from '../../views/materialRequestView';
import { NumberingService } from '../numbering/numberingService';
import {
  MATERIAL_REQUEST_TRANSITIONS,
  MaterialRequestAction,
  MaterialRequestActor,
} from './materialRequest.stateMachine';
import { isWorkOrderTerminal } from '../workOrder/workOrder.stateMachine';

export interface MaterialRequestItemInput {
  particular: string;
  make: string;
  size: string;
  quantity: number;
  unit: string;
  attachments?: { photos?: string[]; audio?: string | null };
}

export interface SubmitInput {
  workOrderId: string;
  supervisorUid: string;
  items: MaterialRequestItemInput[];
}

export interface AssignVendorInput {
  expectedDate: string;
  vendor: string;
  poNumber?: string;
  remarks?: string;
}

export interface MaterialRequestServiceDeps {
  materialRequestRepository: MaterialRequestRepository;
  workOrderRepository: WorkOrderRepository;
  projectRepository: ProjectRepository;
  userRepository: UserRepository;
  numberingService: NumberingService;
  clock: Clock;
}

/** Friendly verbs for the 409 message when a transition is attempted from the wrong status. */
const ACTION_VERB: Record<MaterialRequestAction, string> = {
  accept: 'accept',
  assignVendor: 'assign a vendor to',
  decline: 'decline',
  cancel: 'cancel',
  close: 'close',
  return: 'return',
  supersede: 'supersede',
};

export class MaterialRequestService {
  constructor(private readonly deps: MaterialRequestServiceDeps) {}

  /**
   * Submits a multi-item request against one ASSIGNED work order. Each item becomes its own entry
   * (sharing a batchId), gets an item number, and starts `requested`. Returns enriched views so
   * the client can show the just-submitted rows without a refetch.
   */
  async submit({ workOrderId, supervisorUid, items }: SubmitInput): Promise<MaterialRequestView[]> {
    const workOrder = await this.deps.workOrderRepository.findById(workOrderId);
    if (!workOrder) throw new AppError(404, 'Work order not found');
    if (workOrder.supervisorId !== supervisorUid) {
      throw new AppError(403, 'You are not assigned to this work order');
    }
    if (isWorkOrderTerminal(workOrder.status)) {
      throw new AppError(409, `Work order is ${workOrder.status}`);
    }
    const project = await this.deps.projectRepository.findById(workOrder.project);
    if (project?.status === 'completed') {
      throw new AppError(409, 'Project is completed');
    }

    // Attachment paths must be the supervisor's own uploads — reject forged/foreign paths.
    for (const item of items) {
      const paths = [...(item.attachments?.photos ?? [])];
      if (item.attachments?.audio) paths.push(item.attachments.audio);
      for (const path of paths) {
        if (!isOwnAttachmentPath(path, supervisorUid)) {
          throw new AppError(400, 'Attachment must be your own upload');
        }
      }
    }

    const now = this.deps.clock();
    const batchId = randomUUID();
    // Reserve all item numbers in one counter transaction (not one per item).
    const itemNumbers = await this.deps.numberingService.nextItemNumbers(
      workOrderId,
      workOrder.number,
      items.length,
    );
    const inputs: CreateMaterialRequestInput[] = items.map((item, i) => ({
      itemNumber: itemNumbers[i],
      workOrder: workOrderId,
      project: workOrder.project,
      orderBy: supervisorUid,
      supervisorId: supervisorUid,
      batchId,
      particular: item.particular,
      make: item.make,
      size: item.size,
      quantity: item.quantity,
      unit: item.unit,
      attachments: {
        photos: item.attachments?.photos ?? [],
        audio: item.attachments?.audio ?? null,
      },
      status: 'requested',
      createdAt: now.toISOString(),
      expectedDate: null,
      vendor: null,
      poNumber: null,
      remarks: null,
      returnReason: null,
    }));

    const created = await this.deps.materialRequestRepository.createMany(inputs);
    return this.enrich(created);
  }

  /** Admins see all requests; supervisors see only their visible ones (current assignment). */
  async listForUser(
    auth: AuthUser,
    query: MaterialRequestQuery = {},
  ): Promise<Page<MaterialRequestView>> {
    const page =
      auth.role === 'admin'
        ? await this.deps.materialRequestRepository.list(query)
        : await this.deps.materialRequestRepository.listBySupervisor(auth.uid, query);
    return { items: await this.enrich(page.items), nextCursor: page.nextCursor };
  }

  /** Count of matching items — admins count all, supervisors count only their visible ones.
   * Drives the "to review" badge (e.g. `{ status: 'requested' }`). */
  async countForUser(auth: AuthUser, filter: MaterialRequestFilter = {}): Promise<number> {
    return auth.role === 'admin'
      ? this.deps.materialRequestRepository.count(filter)
      : this.deps.materialRequestRepository.countBySupervisor(auth.uid, filter);
  }

  // ---- Admin transitions ------------------------------------------------------------------

  /** requested → processing (admin accepts/approves). */
  async accept(id: string, remarks?: string): Promise<MaterialRequestView> {
    return this.transition(id, 'accept', { patch: remarks === undefined ? {} : { remarks } });
  }

  /** processing → accepted (admin assigns the vendor + supply details). */
  async assignVendor(id: string, input: AssignVendorInput): Promise<MaterialRequestView> {
    return this.transition(id, 'assignVendor', {
      patch: {
        expectedDate: input.expectedDate,
        vendor: input.vendor,
        poNumber: input.poNumber ?? null,
        remarks: input.remarks ?? null,
      },
    });
  }

  /** requested|processing → declined (admin; reason required). */
  async decline(id: string, remarks: string): Promise<MaterialRequestView> {
    return this.transition(id, 'decline', { patch: { remarks } });
  }

  // ---- Supervisor transitions -------------------------------------------------------------

  /** requested → cancelled (owning supervisor). */
  async cancel(id: string, supervisorUid: string): Promise<MaterialRequestView> {
    return this.transition(id, 'cancel', { actorUid: supervisorUid });
  }

  /** accepted → closed (the assigned supervisor finalizes after delivery). */
  async close(id: string, supervisorUid: string): Promise<MaterialRequestView> {
    return this.transition(id, 'close', { actorUid: supervisorUid });
  }

  /** accepted → returned (the assigned supervisor; reason required). */
  async returnItem(
    id: string,
    supervisorUid: string,
    reason: string,
  ): Promise<MaterialRequestView> {
    return this.transition(id, 'return', {
      actorUid: supervisorUid,
      patch: { returnReason: reason },
    });
  }

  // ---- The single transition funnel (ADR-0006) --------------------------------------------

  private async transition(
    id: string,
    action: MaterialRequestAction,
    opts: { actorUid?: string; patch?: MaterialRequestPatch } = {},
  ): Promise<MaterialRequestView> {
    const rule = MATERIAL_REQUEST_TRANSITIONS[action];
    // The decision runs INSIDE the repo's Firestore transaction, so the status read, the checks,
    // and the write are atomic — concurrent transitions on the same item can't race (the loser
    // re-reads the new status and is rejected). Ownership (403) is checked before the status gate
    // (409).
    const updated = await this.deps.materialRequestRepository.transition(id, (current) => {
      this.assertActor(rule.actor, current, opts.actorUid);
      if (!rule.from.includes(current.status)) {
        throw new AppError(409, `Cannot ${ACTION_VERB[action]} a ${current.status} request`);
      }
      return { status: rule.to, ...opts.patch };
    });
    if (!updated) throw new AppError(404, 'Material request not found');
    return (await this.enrich([updated]))[0];
  }

  private assertActor(
    actor: MaterialRequestActor,
    request: MaterialRequest,
    actorUid?: string,
  ): void {
    // 'owner' = who raised it (audit); 'assignee' = the work order's current supervisor.
    // 'admin'/'system' carry no ownership check (admin role is enforced at the route).
    if (actor === 'owner' && request.orderBy !== actorUid) {
      throw new AppError(403, 'Forbidden');
    }
    if (actor === 'assignee' && request.supervisorId !== actorUid) {
      throw new AppError(403, 'Forbidden');
    }
  }

  /** Resolves each request's work order + project (names/numbers/client) and current supervisor
   * name via batch lookups, then maps to view objects. */
  private async enrich(requests: MaterialRequest[]): Promise<MaterialRequestView[]> {
    if (requests.length === 0) return [];
    const projectIds = uniqueDefined(requests.map((r) => r.project));
    const workOrderIds = uniqueDefined(requests.map((r) => r.workOrder));
    const supervisorUids = uniqueDefined(requests.map((r) => r.supervisorId));
    const [projects, workOrders, supervisors] = await Promise.all([
      this.deps.projectRepository.findByIds(projectIds),
      this.deps.workOrderRepository.findByIds(workOrderIds),
      this.deps.userRepository.findByUids(supervisorUids),
    ]);
    const projectsById = new Map(projects.map((p) => [p.id, p]));
    const workOrdersById = new Map(workOrders.map((w) => [w.id, w]));
    const supervisorNames = new Map(supervisors.map((s) => [s.uid, s.name]));
    return requests.map((r) =>
      toMaterialRequestView(r, projectsById, workOrdersById, supervisorNames),
    );
  }
}
