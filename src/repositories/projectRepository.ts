import { Project } from '../models/project';
import { Page, PageQuery } from '../utils/pagination';

export type CreateProjectInput = Omit<Project, 'id'>;
export type ProjectPatch = Partial<Omit<Project, 'id'>>;

/** Persistence port for `projects`. */
export interface ProjectRepository {
  create(input: CreateProjectInput): Promise<Project>;
  findById(id: string): Promise<Project | null>;
  /** Batch fetch by id (one round trip); missing ids are simply absent from the result. */
  findByIds(ids: string[]): Promise<Project[]>;
  /** Cursor-paginated admin list (newest first). */
  list(query?: PageQuery): Promise<Page<Project>>;
  /** Projects assigned to any of the given supervisors (batched), newest first. Used to
   * resolve a page of supervisors' project names without scanning the whole collection. */
  findBySupervisorIds(supervisorIds: string[]): Promise<Project[]>;
  /** A supervisor's own projects, cursor-paginated (newest first). */
  listBySupervisor(supervisorId: string, query?: PageQuery): Promise<Page<Project>>;
  update(id: string, patch: ProjectPatch): Promise<Project | null>;
}
