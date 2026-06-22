import { Role } from '../types/auth';

/**
 * A user record in the `users` collection. The document id is the Firebase Auth uid.
 * Covers both admins and supervisors (distinguished by `role`).
 */
export interface UserRecord {
  uid: string;
  role: Role;
  name: string;
  email: string;
  phone?: string;
  /** Profile image URL (Storage path). Supervisor-editable via PATCH /me; admins have none. */
  photoUrl?: string | null;
  isActive: boolean;
  /** ISO timestamp. */
  createdAt: string;
  /** uid of the admin who created this account (for supervisors). */
  createdBy?: string;
  /** True until the supervisor sets their own password. */
  mustChangePassword?: boolean;
}
