import { AppError } from '../../utils/AppError';
import { uniqueDefined } from '../../utils/collection';
import { Clock } from '../../utils/clock';
import { AuthUser } from '../../types/auth';
import { Project } from '../../models/project';
import { ProjectRepository } from '../../repositories/projectRepository';
import { UserRepository } from '../../repositories/userRepository';
import { ProjectView, toProjectView } from '../../views/projectView';
import { Page, PageQuery } from '../../utils/pagination';
import { NumberingService } from '../numbering/numberingService';

export interface CreateProjectServiceInput {
  particular: string;
  clientName: string;
  date: string;
  createdBy: string;
}

export interface ProjectServiceDeps {
  projectRepository: ProjectRepository;
  userRepository: UserRepository;
  numberingService: NumberingService;
  clock: Clock;
}

export class ProjectService {
  constructor(private readonly deps: ProjectServiceDeps) {}

  /** Creates a project, generating its PO number at creation time. */
  async create(input: CreateProjectServiceInput): Promise<Project> {
    const now = this.deps.clock();
    const po = await this.deps.numberingService.nextPoNumber(now);

    return this.deps.projectRepository.create({
      particular: input.particular,
      clientName: input.clientName,
      date: input.date,
      po,
      supervisorId: null,
      status: 'active',
      createdAt: now.toISOString(),
      createdBy: input.createdBy,
    });
  }

  /** Admins see all projects; supervisors see only their own. One cursor-paginated page,
   * each row carrying its assigned supervisor's name (resolved here so clients don't look it up). */
  async listForUser(auth: AuthUser, query: PageQuery = {}): Promise<Page<ProjectView>> {
    const page =
      auth.role === 'admin'
        ? await this.deps.projectRepository.list(query)
        : await this.deps.projectRepository.listBySupervisor(auth.uid, query);
    const names = await this.supervisorNames(page.items.map((p) => p.supervisorId));
    return { items: page.items.map((p) => toProjectView(p, names)), nextCursor: page.nextCursor };
  }

  /** uid → name, for the assigned supervisors referenced by [supervisorIds]. */
  private async supervisorNames(supervisorIds: (string | null)[]): Promise<Map<string, string>> {
    const uids = uniqueDefined(supervisorIds);
    if (uids.length === 0) return new Map();
    const users = await this.deps.userRepository.findByUids(uids);
    return new Map(users.map((u) => [u.uid, u.name]));
  }

  async getForUser(id: string, auth: AuthUser): Promise<Project> {
    const project = await this.deps.projectRepository.findById(id);
    if (!project) {
      throw new AppError(404, 'Project not found');
    }
    if (auth.role === 'supervisor' && project.supervisorId !== auth.uid) {
      throw new AppError(403, 'Forbidden');
    }
    return project;
  }

  /** Assigns an existing supervisor to a project (admin action). */
  async assignSupervisor(projectId: string, supervisorId: string): Promise<ProjectView> {
    const project = await this.deps.projectRepository.findById(projectId);
    if (!project) {
      throw new AppError(404, 'Project not found');
    }

    const user = await this.deps.userRepository.findByUid(supervisorId);
    if (!user || user.role !== 'supervisor') {
      throw new AppError(400, 'Supervisor not found');
    }

    const updated = await this.deps.projectRepository.update(projectId, { supervisorId });
    if (!updated) {
      throw new AppError(404, 'Project not found');
    }
    // We just resolved the supervisor — return the name so the client doesn't refetch.
    return toProjectView(updated, new Map([[user.uid, user.name]]));
  }
}
