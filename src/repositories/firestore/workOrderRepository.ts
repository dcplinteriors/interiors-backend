import { CollectionReference, Query } from 'firebase-admin/firestore';
import { getDb } from '../../config/firebase';
import { WorkOrder } from '../../models/workOrder';
import { clampLimit, Page, toPage } from '../../utils/pagination';
import {
  CreateWorkOrderInput,
  WorkOrderPatch,
  WorkOrderQuery,
  WorkOrderRepository,
} from '../workOrderRepository';
import { byCreatedAtDesc, mapDoc, paged } from './helpers';

const COLLECTION = 'workOrders';

export class FirestoreWorkOrderRepository implements WorkOrderRepository {
  private col(): CollectionReference {
    return getDb().collection(COLLECTION);
  }

  async create(input: CreateWorkOrderInput): Promise<WorkOrder> {
    const ref = this.col().doc();
    await ref.set(input);
    return { id: ref.id, ...input };
  }

  async createMany(inputs: CreateWorkOrderInput[]): Promise<WorkOrder[]> {
    const db = getDb();
    const batch = db.batch();
    const col = this.col();
    const results = inputs.map((input) => {
      const ref = col.doc();
      batch.set(ref, input);
      return { id: ref.id, ...input };
    });
    await batch.commit();
    return results;
  }

  async findById(id: string): Promise<WorkOrder | null> {
    const doc = await this.col().doc(id).get();
    return doc.exists ? mapDoc<WorkOrder>(doc) : null;
  }

  async findByIds(ids: string[]): Promise<WorkOrder[]> {
    if (ids.length === 0) return [];
    const refs = ids.map((id) => this.col().doc(id));
    const docs = await getDb().getAll(...refs);
    return docs.filter((d) => d.exists).map((d) => mapDoc<WorkOrder>(d));
  }

  /** All work orders under a project — single-field filter (no composite index), newest first. */
  async findByProject(projectId: string): Promise<WorkOrder[]> {
    const snap = await this.col().where('project', '==', projectId).get();
    return snap.docs.map((d) => mapDoc<WorkOrder>(d)).sort(byCreatedAtDesc);
  }

  /** Work orders under any of [projectIds], batched into `in` queries (max 10 values each). */
  async findByProjectIds(projectIds: string[]): Promise<WorkOrder[]> {
    const ids = [...new Set(projectIds)];
    if (ids.length === 0) return [];
    const chunks: string[][] = [];
    for (let i = 0; i < ids.length; i += 10) chunks.push(ids.slice(i, i + 10));
    const snaps = await Promise.all(
      chunks.map((chunk) => this.col().where('project', 'in', chunk).get()),
    );
    return snaps.flatMap((s) => s.docs.map((d) => mapDoc<WorkOrder>(d))).sort(byCreatedAtDesc);
  }

  /** Work orders assigned to any of [supervisorIds], batched into `in` queries (max 10 each). */
  async findBySupervisorIds(supervisorIds: string[]): Promise<WorkOrder[]> {
    const ids = [...new Set(supervisorIds)];
    if (ids.length === 0) return [];
    const chunks: string[][] = [];
    for (let i = 0; i < ids.length; i += 10) chunks.push(ids.slice(i, i + 10));
    const snaps = await Promise.all(
      chunks.map((chunk) => this.col().where('supervisorId', 'in', chunk).get()),
    );
    return snaps.flatMap((s) => s.docs.map((d) => mapDoc<WorkOrder>(d))).sort(byCreatedAtDesc);
  }

  async list(query: WorkOrderQuery = {}): Promise<Page<WorkOrder>> {
    let q: Query = this.col();
    if (query.project) q = q.where('project', '==', query.project);
    if (query.status) q = q.where('status', '==', query.status);
    const snap = await paged(q, query.limit, query.cursor).get();
    return toPage(snap.docs.map((d) => mapDoc<WorkOrder>(d)), clampLimit(query.limit));
  }

  async listBySupervisor(
    supervisorId: string,
    query: WorkOrderQuery = {},
  ): Promise<Page<WorkOrder>> {
    let q: Query = this.col().where('supervisorId', '==', supervisorId);
    if (query.project) q = q.where('project', '==', query.project);
    if (query.status) q = q.where('status', '==', query.status);
    const snap = await paged(q, query.limit, query.cursor).get();
    return toPage(snap.docs.map((d) => mapDoc<WorkOrder>(d)), clampLimit(query.limit));
  }

  async update(id: string, patch: WorkOrderPatch): Promise<WorkOrder | null> {
    const ref = this.col().doc(id);
    const existing = await ref.get();
    if (!existing.exists) return null;
    await ref.set(patch, { merge: true });
    const updated = await ref.get();
    return mapDoc<WorkOrder>(updated);
  }

  async transition(
    id: string,
    decide: (current: WorkOrder) => WorkOrderPatch,
  ): Promise<WorkOrder | null> {
    const db = getDb();
    const ref = this.col().doc(id);
    return db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) return null;
      const current = mapDoc<WorkOrder>(snap);
      const patch = decide(current); // validates; throws to abort the transaction
      tx.set(ref, patch, { merge: true });
      return { ...current, ...patch };
    });
  }
}
