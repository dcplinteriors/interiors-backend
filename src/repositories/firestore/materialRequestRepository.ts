import { CollectionReference, Query } from 'firebase-admin/firestore';
import { getDb } from '../../config/firebase';
import { MaterialRequest } from '../../models/materialRequest';
import { clampLimit, Page, toPage } from '../../utils/pagination';
import {
  CreateMaterialRequestInput,
  MaterialRequestFilter,
  MaterialRequestPatch,
  MaterialRequestQuery,
  MaterialRequestRepository,
} from '../materialRequestRepository';
import { byCreatedAtDesc, mapDoc, paged } from './helpers';

const COLLECTION = 'materialRequests';
// Firestore caps a WriteBatch at 500 operations.
const BATCH_LIMIT = 500;

export class FirestoreMaterialRequestRepository implements MaterialRequestRepository {
  private col(): CollectionReference {
    return getDb().collection(COLLECTION);
  }

  async createMany(inputs: CreateMaterialRequestInput[]): Promise<MaterialRequest[]> {
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

  async findById(id: string): Promise<MaterialRequest | null> {
    const doc = await this.col().doc(id).get();
    return doc.exists ? mapDoc<MaterialRequest>(doc) : null;
  }

  /** All items on a work order — single-field filter (no composite index), newest first. */
  async findByWorkOrder(workOrderId: string): Promise<MaterialRequest[]> {
    const snap = await this.col().where('workOrder', '==', workOrderId).get();
    return snap.docs.map((d) => mapDoc<MaterialRequest>(d)).sort(byCreatedAtDesc);
  }

  /**
   * Cursor-paginated. Filters (workOrder/project/status) are applied in the query, ordered by
   * `createdAt` desc with the document id as a tiebreaker (batch items share `createdAt`), so the
   * cursor is stable. Requires the composite indexes in `firestore.indexes.json`.
   */
  async list(query: MaterialRequestQuery = {}): Promise<Page<MaterialRequest>> {
    let q: Query = this.col();
    if (query.workOrder) q = q.where('workOrder', '==', query.workOrder);
    if (query.project) q = q.where('project', '==', query.project);
    if (query.status) q = q.where('status', '==', query.status);

    const snap = await paged(q, query.limit, query.cursor).get();
    return toPage(snap.docs.map((d) => mapDoc<MaterialRequest>(d)), clampLimit(query.limit));
  }

  /**
   * A supervisor's visible items — those on work orders CURRENTLY assigned to them, keyed on the
   * denormalized `supervisorId` (not `orderBy`, so reassigned items follow the assignment). With
   * optional server-side workOrder/project/status filters. Requires the matching composite
   * indexes.
   */
  async listBySupervisor(
    supervisorId: string,
    query: MaterialRequestQuery = {},
  ): Promise<Page<MaterialRequest>> {
    let q: Query = this.col().where('supervisorId', '==', supervisorId);
    if (query.workOrder) q = q.where('workOrder', '==', query.workOrder);
    if (query.project) q = q.where('project', '==', query.project);
    if (query.status) q = q.where('status', '==', query.status);

    const snap = await paged(q, query.limit, query.cursor).get();
    return toPage(snap.docs.map((d) => mapDoc<MaterialRequest>(d)), clampLimit(query.limit));
  }

  async count(filter: MaterialRequestFilter = {}): Promise<number> {
    return this.countMatching(this.col(), filter);
  }

  async countBySupervisor(supervisorId: string, filter: MaterialRequestFilter = {}): Promise<number> {
    return this.countMatching(this.col().where('supervisorId', '==', supervisorId), filter);
  }

  /** Uses Firestore's count() aggregation — bills 1 read per ~1000 matches, not one per doc. */
  private async countMatching(base: Query, filter: MaterialRequestFilter): Promise<number> {
    let q = base;
    if (filter.workOrder) q = q.where('workOrder', '==', filter.workOrder);
    if (filter.project) q = q.where('project', '==', filter.project);
    if (filter.statusIn && filter.statusIn.length > 0) {
      q = q.where('status', 'in', filter.statusIn);
    } else if (filter.status) {
      q = q.where('status', '==', filter.status);
    }
    const snap = await q.count().get();
    return snap.data().count;
  }

  async update(id: string, patch: MaterialRequestPatch): Promise<MaterialRequest | null> {
    const ref = this.col().doc(id);
    const existing = await ref.get();
    if (!existing.exists) return null;
    await ref.set(patch, { merge: true });
    const updated = await ref.get();
    return mapDoc<MaterialRequest>(updated);
  }

  async transition(
    id: string,
    decide: (current: MaterialRequest) => MaterialRequestPatch,
  ): Promise<MaterialRequest | null> {
    const db = getDb();
    const ref = this.col().doc(id);
    return db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) return null;
      const current = mapDoc<MaterialRequest>(snap);
      const patch = decide(current); // validates; throws to abort the transaction
      tx.set(ref, patch, { merge: true });
      return { ...current, ...patch };
    });
  }

  async updateMany(updates: { id: string; patch: MaterialRequestPatch }[]): Promise<void> {
    if (updates.length === 0) return;
    const db = getDb();
    const col = this.col();
    // Chunk to the 500-op batch limit so a work order with many items can still be swept on
    // reassignment/unassign. Each chunk commits atomically; the common case (≤500 items) is a
    // single atomic batch.
    for (let i = 0; i < updates.length; i += BATCH_LIMIT) {
      const batch = db.batch();
      for (const { id, patch } of updates.slice(i, i + BATCH_LIMIT)) {
        batch.set(col.doc(id), patch, { merge: true });
      }
      await batch.commit();
    }
  }
}
