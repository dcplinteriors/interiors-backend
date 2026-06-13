import { Role } from '../../src/types/auth';
import { UserRecord } from '../../src/models/user';
import { Page, PageQuery } from '../../src/utils/pagination';
import { UserRepository } from '../../src/repositories/userRepository';
import { byCreatedAtThenKeyDesc, paginateSorted } from './pagination';

const byCreatedAtThenUidDesc = byCreatedAtThenKeyDesc<UserRecord>((u) => u.uid);

export class FakeUserRepository implements UserRepository {
  private readonly byUid = new Map<string, UserRecord>();

  constructor(seed: UserRecord[] = []) {
    seed.forEach((u) => this.byUid.set(u.uid, u));
  }

  async create(user: UserRecord): Promise<UserRecord> {
    this.byUid.set(user.uid, user);
    return user;
  }

  async findByUid(uid: string): Promise<UserRecord | null> {
    return this.byUid.get(uid) ?? null;
  }

  async findByUids(uids: string[]): Promise<UserRecord[]> {
    return uids.map((uid) => this.byUid.get(uid)).filter((u): u is UserRecord => u != null);
  }

  async findByEmail(email: string): Promise<UserRecord | null> {
    // Exact match, mirroring Firestore's case-sensitive `where('email','==',…)`.
    for (const u of this.byUid.values()) {
      if (u.email === email) return u;
    }
    return null;
  }

  async listByRole(role: Role, query: PageQuery = {}): Promise<Page<UserRecord>> {
    const sorted = [...this.byUid.values()]
      .filter((u) => u.role === role)
      .sort(byCreatedAtThenUidDesc);
    return paginateSorted(sorted, query.limit, query.cursor, (u) => u.uid);
  }
}
