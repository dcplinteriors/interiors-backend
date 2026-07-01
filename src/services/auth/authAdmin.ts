import { Role } from '../../types/auth';
import { getAuth } from '../../config/firebase';

export interface CreateAuthUserInput {
  email: string;
  password: string;
  displayName?: string;
}

/**
 * Privileged Firebase Auth operations. Abstracted behind an interface so the supervisor
 * service can be tested without Firebase.
 */
export interface AuthAdmin {
  /** Creates an Auth user with an initial (temporary) password. */
  createUser(input: CreateAuthUserInput): Promise<{ uid: string }>;
  /** Sets the user's role as a custom claim (read back from the ID token). */
  setRole(uid: string, role: Role): Promise<void>;
  /** Replaces the user's password (used on admin-triggered reset). */
  setPassword(uid: string, password: string): Promise<void>;
  /** Invalidates the user's existing sessions, forcing re-authentication. */
  revokeRefreshTokens(uid: string): Promise<void>;
}

export class FirebaseAuthAdmin implements AuthAdmin {
  async createUser({ email, password, displayName }: CreateAuthUserInput): Promise<{ uid: string }> {
    const user = await getAuth().createUser({ email, password, displayName });
    return { uid: user.uid };
  }

  async setRole(uid: string, role: Role): Promise<void> {
    await getAuth().setCustomUserClaims(uid, { role });
  }

  async setPassword(uid: string, password: string): Promise<void> {
    await getAuth().updateUser(uid, { password });
  }

  async revokeRefreshTokens(uid: string): Promise<void> {
    await getAuth().revokeRefreshTokens(uid);
  }
}
