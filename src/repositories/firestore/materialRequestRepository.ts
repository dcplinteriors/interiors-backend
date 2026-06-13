import { CollectionReference, Query } from 'firebase-admin/firestore';
import { getDb } from '../../config/firebase';
import { MaterialRequest } from '../../models/materialRequest';
import { clampLimit, Page, toPage } from '../../utils/pagination';
import {
  CreateMaterialRequestInput,
  MaterialRequestPatch,
  MaterialRequestQuery,
  MaterialRequestRepository,
} from '../materialRequestRepository';
import { mapDoc, paged } from './helpers';

const COLLECTION = 'materialRequests';

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

  /**
   * Cursor-paginated. Filters (status/project) are applied in the query, ordered by
   * `createdAt` desc with the document id as a tiebreaker (batch items share `createdAt`),
   * so the cursor is stable. Requires the composite indexes in `firestore.indexes.json`.
   */
  async list(query: MaterialRequestQuery = {}): Promise<Page<MaterialRequest>> {
    let q: Query = this.col();
    if (query.project) q = q.where('project', '==', query.project);
    if (query.status) q = q.where('status', '==', query.status);

    const snap = await paged(q, query.limit, query.cursor).get();
    return toPage(snap.docs.map((d) => mapDoc<MaterialRequest>(d)), clampLimit(query.limit));
  }

  /**
   * A supervisor's own requests, cursor-paginated with an optional server-side status filter.
   * Requires the (orderBy, createdAt desc) and (orderBy, status, createdAt desc) composite
   * indexes (__name__ is sorted implicitly, matching createdAt desc).
   */
  async listBySupervisor(
    supervisorId: string,
    query: MaterialRequestQuery = {},
  ): Promise<Page<MaterialRequest>> {
    let q: Query = this.col().where('orderBy', '==', supervisorId);
    if (query.status) q = q.where('status', '==', query.status);

    const snap = await paged(q, query.limit, query.cursor).get();
    return toPage(snap.docs.map((d) => mapDoc<MaterialRequest>(d)), clampLimit(query.limit));
  }

  async update(id: string, patch: MaterialRequestPatch): Promise<MaterialRequest | null> {
    const ref = this.col().doc(id);
    const existing = await ref.get();
    if (!existing.exists) return null;
    await ref.set(patch, { merge: true });
    const updated = await ref.get();
    return mapDoc<MaterialRequest>(updated);
  }
}
