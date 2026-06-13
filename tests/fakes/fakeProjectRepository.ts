import { Project } from '../../src/models/project';
import { Page, PageQuery } from '../../src/utils/pagination';
import {
  CreateProjectInput,
  ProjectPatch,
  ProjectRepository,
} from '../../src/repositories/projectRepository';
import { byCreatedAtThenIdDesc, paginateSorted } from './pagination';

export class FakeProjectRepository implements ProjectRepository {
  private readonly byId = new Map<string, Project>();
  private seq = 0;

  constructor(seed: Project[] = []) {
    seed.forEach((p) => this.byId.set(p.id, p));
  }

  async create(input: CreateProjectInput): Promise<Project> {
    const id = `proj_${++this.seq}`;
    const project: Project = { id, ...input };
    this.byId.set(id, project);
    return project;
  }

  async findById(id: string): Promise<Project | null> {
    return this.byId.get(id) ?? null;
  }

  async findByIds(ids: string[]): Promise<Project[]> {
    return ids.map((id) => this.byId.get(id)).filter((p): p is Project => p != null);
  }

  async list(query: PageQuery = {}): Promise<Page<Project>> {
    return paginateSorted(this.sorted([...this.byId.values()]), query.limit, query.cursor);
  }

  async findBySupervisorIds(supervisorIds: string[]): Promise<Project[]> {
    const wanted = new Set(supervisorIds);
    return this.sorted(
      [...this.byId.values()].filter((p) => p.supervisorId != null && wanted.has(p.supervisorId)),
    );
  }

  async listBySupervisor(supervisorId: string, query: PageQuery = {}): Promise<Page<Project>> {
    const own = this.sorted([...this.byId.values()].filter((p) => p.supervisorId === supervisorId));
    return paginateSorted(own, query.limit, query.cursor);
  }

  // Newest-first, mirroring the Firestore repository's ordering (code-unit id tiebreaker).
  private sorted(items: Project[]): Project[] {
    return items.sort(byCreatedAtThenIdDesc);
  }

  async update(id: string, patch: ProjectPatch): Promise<Project | null> {
    const existing = this.byId.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...patch, id };
    this.byId.set(id, updated);
    return updated;
  }
}
