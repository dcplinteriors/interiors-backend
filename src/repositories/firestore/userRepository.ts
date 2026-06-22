import { CollectionReference } from 'firebase-admin/firestore';
import { getDb } from '../../config/firebase';
import { Role } from '../../types/auth';
import { UserRecord } from '../../models/user';
import { clampLimit, Page, PageQuery, toPage } from '../../utils/pagination';
import { UserRepository } from '../userRepository';
import { paged } from './helpers';

const COLLECTION = 'users';

export class FirestoreUserRepository implements UserRepository {
  private col(): CollectionReference {
    return getDb().collection(COLLECTION);
  }

  async create(user: UserRecord): Promise<UserRecord> {
    await this.col().doc(user.uid).set(user);
    return user;
  }

  async findByUid(uid: string): Promise<UserRecord | null> {
    const doc = await this.col().doc(uid).get();
    return doc.exists ? (doc.data() as UserRecord) : null;
  }

  async findByUids(uids: string[]): Promise<UserRecord[]> {
    if (uids.length === 0) return [];
    const refs = uids.map((uid) => this.col().doc(uid));
    const docs = await getDb().getAll(...refs);
    return docs.filter((d) => d.exists).map((d) => d.data() as UserRecord);
  }

  async findByEmail(email: string): Promise<UserRecord | null> {
    const snap = await this.col().where('email', '==', email).limit(1).get();
    return snap.empty ? null : (snap.docs[0].data() as UserRecord);
  }

  /**
   * Cursor-paginated. The cursor id is the doc id (= uid). Requires the
   * (role, createdAt desc) composite index.
   */
  async listByRole(role: Role, query: PageQuery = {}): Promise<Page<UserRecord>> {
    const snap = await paged(this.col().where('role', '==', role), query.limit, query.cursor).get();
    const users = snap.docs.map((d) => d.data() as UserRecord);
    return toPage(users, clampLimit(query.limit), (u) => u.uid);
  }

  async update(uid: string, patch: Partial<Omit<UserRecord, 'uid'>>): Promise<UserRecord | null> {
    const ref = this.col().doc(uid);
    const existing = await ref.get();
    if (!existing.exists) return null;
    await ref.set(patch, { merge: true });
    const updated = await ref.get();
    return updated.data() as UserRecord;
  }
}
