import { AppError } from '../../utils/AppError';
import { uniqueDefined } from '../../utils/collection';
import { Clock } from '../../utils/clock';
import { AuthUser } from '../../types/auth';
import { WorkOrder } from '../../models/workOrder';
import { ProjectRepository } from '../../repositories/projectRepository';
import {
  CreateWorkOrderInput,
  WorkOrderRepository,
} from '../../repositories/workOrderRepository';
import { UserRepository } from '../../repositories/userRepository';
import { Page, PageQuery } from '../../utils/pagination';
import {
  ProjectDetail,
  ProjectListItem,
  toProjectDetail,
  toProjectListItem,
} from '../../views/projectView';
import { WorkOrderView, toWorkOrderView } from '../../views/workOrderView';
import { NumberingService } from '../numbering/numberingService';
import { isWorkOrderTerminal } from '../workOrder/workOrder.stateMachine';

export interface ProjectWorkOrderInput {
  name: string;
  date: string;
  description?: string;
}

export interface CreateProjectServiceInput {
  name: string;
  clientName: string;
  projectEngineer: string;
  workOrders: ProjectWorkOrderInput[];
  createdBy: string;
}

export interface ProjectServiceDeps {
  projectRepository: ProjectRepository;
  workOrderRepository: WorkOrderRepository;
  userRepository: UserRepository;
  numberingService: NumberingService;
  clock: Clock;
}

export class ProjectService {
  constructor(private readonly deps: ProjectServiceDeps) {}

  /** Creates a project together with its work orders in one flow. Reserves the project number,
   * then a block of work-order numbers (one counter write), and returns the project + its WOs. */
  async create(input: CreateProjectServiceInput): Promise<ProjectDetail> {
    const now = this.deps.clock();
    const number = await this.deps.numberingService.nextProjectNumber(now);
    const project = await this.deps.projectRepository.create({
      number,
      name: input.name,
      clientName: input.clientName,
      projectEngineer: input.projectEngineer,
      status: 'active',
      createdAt: now.toISOString(),
      createdBy: input.createdBy,
    });

    const numbers = await this.deps.numberingService.nextWorkOrderNumbers(
      project.id,
      project.number,
      input.workOrders.length,
    );
    const woInputs: CreateWorkOrderInput[] = input.workOrders.map((w, i) => ({
      project: project.id,
      number: numbers[i],
      name: w.name,
      date: w.date,
      description: w.description ?? null,
      supervisorId: null,
      status: 'pending',
      createdAt: now.toISOString(),
      createdBy: input.createdBy,
    }));
    const workOrders = await this.deps.workOrderRepository.createMany(woInputs);

    return toProjectDetail(project, await this.enrichWorkOrders(workOrders));
  }

  /** Admin list of projects, each carrying a count of its work orders. */
  async list(query: PageQuery = {}): Promise<Page<ProjectListItem>> {
    const page = await this.deps.projectRepository.list(query);
    const workOrders = await this.deps.workOrderRepository.findByProjectIds(
      page.items.map((p) => p.id),
    );
    const counts = new Map<string, number>();
    for (const w of workOrders) counts.set(w.project, (counts.get(w.project) ?? 0) + 1);
    return {
      items: page.items.map((p) => toProjectListItem(p, counts.get(p.id) ?? 0)),
      nextCursor: page.nextCursor,
    };
  }

  /** A project with its work orders. A supervisor sees ONLY the work orders assigned to them
   * (and must have at least one), so sibling work orders stay hidden. */
  async getForUser(id: string, auth: AuthUser): Promise<ProjectDetail> {
    const project = await this.deps.projectRepository.findById(id);
    if (!project) throw new AppError(404, 'Project not found');

    const all = await this.deps.workOrderRepository.findByProject(id);
    if (auth.role === 'supervisor') {
      const own = all.filter((w) => w.supervisorId === auth.uid);
      if (own.length === 0) throw new AppError(403, 'Forbidden');
      return toProjectDetail(project, await this.enrichWorkOrders(own));
    }
    return toProjectDetail(project, await this.enrichWorkOrders(all));
  }

  /** Completes a project (admin) — gated on every work order being `completed` or `cancelled`. */
  async complete(projectId: string): Promise<ProjectDetail> {
    // The work-order gate is read before the transaction; the project's own status is re-checked
    // atomically with the write, so two admins can't double-complete. (Work orders never leave a
    // terminal state, so the gate result can't be invalidated by a concurrent WO transition; the
    // only narrow window is a work order being added mid-complete, which `addToProject` blocks once
    // the project is `completed`.)
    const workOrders = await this.deps.workOrderRepository.findByProject(projectId);
    const allTerminal = workOrders.every((w) => isWorkOrderTerminal(w.status));
    const updated = await this.deps.projectRepository.transition(projectId, (project) => {
      if (project.status === 'completed') {
        throw new AppError(409, 'Project is already completed');
      }
      if (!allTerminal) {
        throw new AppError(409, 'Project has work orders that are not completed or cancelled');
      }
      return { status: 'completed' };
    });
    if (!updated) throw new AppError(404, 'Project not found');
    return toProjectDetail(updated, await this.enrichWorkOrders(workOrders));
  }

  private async enrichWorkOrders(workOrders: WorkOrder[]): Promise<WorkOrderView[]> {
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
