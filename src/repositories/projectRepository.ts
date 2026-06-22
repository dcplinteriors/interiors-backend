import { Project } from '../models/project';
import { Page, PageQuery } from '../utils/pagination';

export type CreateProjectInput = Omit<Project, 'id'>;
export type ProjectPatch = Partial<Omit<Project, 'id'>>;

/** Persistence port for `projects`. Supervisors are assigned at the work-order level, so there's
 * no supervisor-scoped project query here. */
export interface ProjectRepository {
  create(input: CreateProjectInput): Promise<Project>;
  findById(id: string): Promise<Project | null>;
  /** Batch fetch by id (one round trip); missing ids are simply absent from the result. */
  findByIds(ids: string[]): Promise<Project[]>;
  /** Cursor-paginated admin list (newest first). */
  list(query?: PageQuery): Promise<Page<Project>>;
  update(id: string, patch: ProjectPatch): Promise<Project | null>;
  /** Atomically transitions a project in a Firestore transaction: reads it, applies `decide`
   * (which validates and returns a patch, or throws to abort), then writes — so the status check
   * and the write can't race. Returns the updated project, or `null` if it doesn't exist. */
  transition(id: string, decide: (current: Project) => ProjectPatch): Promise<Project | null>;
}
