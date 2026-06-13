import { Role } from '../types/auth';
import { UserRecord } from '../models/user';
import { Page, PageQuery } from '../utils/pagination';

/** Persistence port for `users`. The document id is the uid. */
export interface UserRepository {
  create(user: UserRecord): Promise<UserRecord>;
  findByUid(uid: string): Promise<UserRecord | null>;
  /** Batch fetch by uid (one round trip); missing uids are simply absent from the result. */
  findByUids(uids: string[]): Promise<UserRecord[]>;
  findByEmail(email: string): Promise<UserRecord | null>;
  /** Cursor-paginated list of users with the given role (newest first). */
  listByRole(role: Role, query?: PageQuery): Promise<Page<UserRecord>>;
}
