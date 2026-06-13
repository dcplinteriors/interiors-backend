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
  MaterialRequestQuery,
  MaterialRequestRepository,
} from '../../repositories/materialRequestRepository';
import { ProjectRepository } from '../../repositories/projectRepository';
import { UserRepository } from '../../repositories/userRepository';
import { MaterialRequestView, toMaterialRequestView } from '../../views/materialRequestView';
import { NumberingService } from '../numbering/numberingService';

export interface MaterialRequestItemInput {
  particular: string;
  make: string;
  size: string;
  quantity: number;
  unit: string;
  attachments?: { photos?: string[]; audio?: string | null };
}

export interface SubmitInput {
  projectId: string;
  supervisorUid: string;
  items: MaterialRequestItemInput[];
}

export interface AcceptInput {
  expectedDate: string;
  vendor: string;
  remarks?: string;
}

export interface DeclineInput {
  remarks?: string;
}

export interface MaterialRequestServiceDeps {
  materialRequestRepository: MaterialRequestRepository;
  projectRepository: ProjectRepository;
  userRepository: UserRepository;
  numberingService: NumberingService;
  clock: Clock;
}

export class MaterialRequestService {
  constructor(private readonly deps: MaterialRequestServiceDeps) {}

  /**
   * Submits a multi-item request against one project. Each item becomes its own entry
   * (sharing a batchId), gets a generated Job number, and inherits the project's PO number.
   * Returns enriched views so the client can show the just-submitted rows (project name etc.)
   * without a refetch.
   */
  async submit({ projectId, supervisorUid, items }: SubmitInput): Promise<MaterialRequestView[]> {
    const project = await this.deps.projectRepository.findById(projectId);
    if (!project) {
      throw new AppError(404, 'Project not found');
    }
    if (project.supervisorId !== supervisorUid) {
      throw new AppError(403, 'You are not assigned to this project');
    }

    // Attachment paths must be the supervisor's own uploads (issued by /uploads/sign) —
    // reject forged/foreign/garbage paths before they're stored on the request.
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

    // Reserve all Job numbers in one counter transaction (not one per item) so a large or
    // concurrent submission doesn't contend on the hot counter doc.
    const jobNumbers = await this.deps.numberingService.nextJobNumbers(now, items.length);
    const inputs: CreateMaterialRequestInput[] = items.map((item, i) => ({
      project: projectId,
      orderBy: supervisorUid,
      poNumber: project.po,
      jobNumber: jobNumbers[i],
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
      remarks: null,
    }));

    const created = await this.deps.materialRequestRepository.createMany(inputs);
    return this.enrich(created);
  }

  /** Admins see all requests; supervisors see only their own. Both can filter. Each request
   * carries its project's client name and the ordering supervisor's name. */
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

  async accept(id: string, input: AcceptInput): Promise<MaterialRequestView> {
    await this.requireRequested(id);
    const updated = await this.applyPatch(id, {
      status: 'accepted',
      expectedDate: input.expectedDate,
      vendor: input.vendor,
      remarks: input.remarks ?? null,
    });
    return (await this.enrich([updated]))[0];
  }

  async decline(id: string, input: DeclineInput): Promise<MaterialRequestView> {
    await this.requireRequested(id);
    const updated = await this.applyPatch(id, { status: 'declined', remarks: input.remarks ?? null });
    return (await this.enrich([updated]))[0];
  }

  /** Resolves each request's client name (from its project) and supervisor name (from its
   * orderBy uid) via two batch lookups, then maps to view objects. */
  private async enrich(requests: MaterialRequest[]): Promise<MaterialRequestView[]> {
    if (requests.length === 0) return [];
    const projectIds = uniqueDefined(requests.map((r) => r.project));
    const supervisorUids = uniqueDefined(requests.map((r) => r.orderBy));
    const [projects, supervisors] = await Promise.all([
      this.deps.projectRepository.findByIds(projectIds),
      this.deps.userRepository.findByUids(supervisorUids),
    ]);
    const projectsById = new Map(projects.map((p) => [p.id, p]));
    const supervisorNames = new Map(supervisors.map((s) => [s.uid, s.name]));
    return requests.map((r) => toMaterialRequestView(r, projectsById, supervisorNames));
  }

  /** A supervisor may cancel their own request while it is still `requested`. Returns an
   * enriched view so the in-place row update keeps its project name etc. */
  async cancel(id: string, supervisorUid: string): Promise<MaterialRequestView> {
    const request = await this.findOr404(id);
    if (request.orderBy !== supervisorUid) {
      throw new AppError(403, 'Forbidden');
    }
    if (request.status !== 'requested') {
      throw new AppError(409, `Cannot cancel a ${request.status} request`);
    }
    const updated = await this.applyPatch(id, { status: 'cancelled' });
    return (await this.enrich([updated]))[0];
  }

  private async findOr404(id: string): Promise<MaterialRequest> {
    const request = await this.deps.materialRequestRepository.findById(id);
    if (!request) {
      throw new AppError(404, 'Material request not found');
    }
    return request;
  }

  private async requireRequested(id: string): Promise<MaterialRequest> {
    const request = await this.findOr404(id);
    if (request.status !== 'requested') {
      throw new AppError(409, `Request is already ${request.status}`);
    }
    return request;
  }

  private async applyPatch(
    id: string,
    patch: Parameters<MaterialRequestRepository['update']>[1],
  ): Promise<MaterialRequest> {
    const updated = await this.deps.materialRequestRepository.update(id, patch);
    if (!updated) {
      throw new AppError(404, 'Material request not found');
    }
    return updated;
  }
}
