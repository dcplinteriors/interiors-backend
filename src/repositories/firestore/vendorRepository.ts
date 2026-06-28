import { CollectionReference } from 'firebase-admin/firestore';
import { getDb } from '../../config/firebase';
import { Vendor } from '../../models/vendor';
import { clampLimit, Page, PageQuery, toPage } from '../../utils/pagination';
import { CreateVendorInput, VendorPatch, VendorRepository } from '../vendorRepository';
import { mapDoc, paged } from './helpers';

const COLLECTION = 'vendors';

export class FirestoreVendorRepository implements VendorRepository {
  private col(): CollectionReference {
    return getDb().collection(COLLECTION);
  }

  async create(input: CreateVendorInput): Promise<Vendor> {
    const ref = this.col().doc();
    await ref.set(input);
    return { id: ref.id, ...input };
  }

  async findById(id: string): Promise<Vendor | null> {
    const doc = await this.col().doc(id).get();
    return doc.exists ? mapDoc<Vendor>(doc) : null;
  }

  async findByIds(ids: string[]): Promise<Vendor[]> {
    if (ids.length === 0) return [];
    const refs = ids.map((id) => this.col().doc(id));
    const docs = await getDb().getAll(...refs);
    return docs.filter((d) => d.exists).map((d) => mapDoc<Vendor>(d));
  }

  /** Cursor-paginated admin list. Unfiltered, so no composite index is needed. */
  async list(query: PageQuery = {}): Promise<Page<Vendor>> {
    const snap = await paged(this.col(), query.limit, query.cursor).get();
    return toPage(snap.docs.map((d) => mapDoc<Vendor>(d)), clampLimit(query.limit));
  }

  async update(id: string, patch: VendorPatch): Promise<Vendor | null> {
    const ref = this.col().doc(id);
    const existing = await ref.get();
    if (!existing.exists) return null;
    await ref.set(patch, { merge: true });
    const updated = await ref.get();
    return mapDoc<Vendor>(updated);
  }
}
