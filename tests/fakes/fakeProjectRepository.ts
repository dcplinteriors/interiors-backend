import { Project } from '../../src/models/project';
import { WorkOrder } from '../../src/models/workOrder';
import { Page, PageQuery } from '../../src/utils/pagination';
import {
  CreateProjectInput,
  ProjectPatch,
  ProjectRepository,
} from '../../src/repositories/projectRepository';
import {
  CreateWorkOrderInput,
  WorkOrderRepository,
} from '../../src/repositories/workOrderRepository';
import { byCreatedAtThenIdDesc, paginateSorted } from './pagination';

export class FakeProjectRepository implements ProjectRepository {
  private readonly byId = new Map<string, Project>();
  private seq = 0;

  /** The work-order store the aggregate `createWithWorkOrders` writes into. Pass the same
   * FakeWorkOrderRepository the service uses, so created work orders are visible to reads. */
  constructor(
    seed: Project[] = [],
    private readonly workOrders?: WorkOrderRepository,
  ) {
    seed.forEach((p) => this.byId.set(p.id, p));
  }

  async create(input: CreateProjectInput): Promise<Project> {
    const id = `proj_${++this.seq}`;
    const project: Project = { id, ...input };
    this.byId.set(id, project);
    return project;
  }

  async createWithWorkOrders(
    projectInput: CreateProjectInput,
    makeWorkOrders: (projectId: string) => Promise<CreateWorkOrderInput[]>,
  ): Promise<{ project: Project; workOrders: WorkOrder[] }> {
    if (!this.workOrders) {
      throw new Error(
        'FakeProjectRepository.createWithWorkOrders needs a work-order repository — ' +
          'construct it as `new FakeProjectRepository(seed, workOrderRepository)`.',
      );
    }
    const id = `proj_${++this.seq}`;
    const woInputs = await makeWorkOrders(id);
    const project: Project = { id, ...projectInput };
    this.byId.set(id, project);
    // In-memory writes can't partially fail, so this faithfully models the atomic batch.
    const workOrders = await this.workOrders.createMany(woInputs);
    return { project, workOrders };
  }

  async findById(id: string): Promise<Project | null> {
    return this.byId.get(id) ?? null;
  }

  async findByIds(ids: string[]): Promise<Project[]> {
    return ids.map((id) => this.byId.get(id)).filter((p): p is Project => p != null);
  }

  async list(query: PageQuery = {}): Promise<Page<Project>> {
    const sorted = [...this.byId.values()].sort(byCreatedAtThenIdDesc);
    return paginateSorted(sorted, query.limit, query.cursor);
  }

  async update(id: string, patch: ProjectPatch): Promise<Project | null> {
    const existing = this.byId.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...patch, id };
    this.byId.set(id, updated);
    return updated;
  }

  async transition(
    id: string,
    decide: (current: Project) => ProjectPatch,
  ): Promise<Project | null> {
    const existing = this.byId.get(id);
    if (!existing) return null;
    const patch = decide(existing); // validates; throws to abort
    const updated = { ...existing, ...patch, id };
    this.byId.set(id, updated);
    return updated;
  }
}
