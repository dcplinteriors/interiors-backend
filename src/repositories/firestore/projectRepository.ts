import { CollectionReference } from 'firebase-admin/firestore';
import { getDb } from '../../config/firebase';
import { Project } from '../../models/project';
import { clampLimit, Page, PageQuery, toPage } from '../../utils/pagination';
import { CreateProjectInput, ProjectPatch, ProjectRepository } from '../projectRepository';
import { byCreatedAtDesc, mapDoc, paged } from './helpers';

const COLLECTION = 'projects';

export class FirestoreProjectRepository implements ProjectRepository {
  private col(): CollectionReference {
    return getDb().collection(COLLECTION);
  }

  async create(input: CreateProjectInput): Promise<Project> {
    const ref = this.col().doc();
    await ref.set(input);
    return { id: ref.id, ...input };
  }

  async findById(id: string): Promise<Project | null> {
    const doc = await this.col().doc(id).get();
    return doc.exists ? mapDoc<Project>(doc) : null;
  }

  async findByIds(ids: string[]): Promise<Project[]> {
    if (ids.length === 0) return [];
    const refs = ids.map((id) => this.col().doc(id));
    const docs = await getDb().getAll(...refs);
    return docs.filter((d) => d.exists).map((d) => mapDoc<Project>(d));
  }

  /** Cursor-paginated admin list. Unfiltered, so no composite index is needed. */
  async list(query: PageQuery = {}): Promise<Page<Project>> {
    const snap = await paged(this.col(), query.limit, query.cursor).get();
    return toPage(snap.docs.map((d) => mapDoc<Project>(d)), clampLimit(query.limit));
  }

  /**
   * Projects for any of [supervisorIds], batched into Firestore `in` queries (max 10 values
   * each). Single-field filter, sorted in memory — no composite index needed.
   */
  async findBySupervisorIds(supervisorIds: string[]): Promise<Project[]> {
    const uids = [...new Set(supervisorIds)];
    if (uids.length === 0) return [];
    const chunks: string[][] = [];
    for (let i = 0; i < uids.length; i += 10) chunks.push(uids.slice(i, i + 10));
    const snaps = await Promise.all(
      chunks.map((chunk) => this.col().where('supervisorId', 'in', chunk).get()),
    );
    return snaps.flatMap((s) => s.docs.map((d) => mapDoc<Project>(d))).sort(byCreatedAtDesc);
  }

  /**
   * A supervisor's own projects, cursor-paginated. Requires the
   * (supervisorId, createdAt desc) composite index.
   */
  async listBySupervisor(supervisorId: string, query: PageQuery = {}): Promise<Page<Project>> {
    const q = this.col().where('supervisorId', '==', supervisorId);
    const snap = await paged(q, query.limit, query.cursor).get();
    return toPage(snap.docs.map((d) => mapDoc<Project>(d)), clampLimit(query.limit));
  }

  async update(id: string, patch: ProjectPatch): Promise<Project | null> {
    const ref = this.col().doc(id);
    const existing = await ref.get();
    if (!existing.exists) return null;
    await ref.set(patch, { merge: true });
    const updated = await ref.get();
    return mapDoc<Project>(updated);
  }
}
