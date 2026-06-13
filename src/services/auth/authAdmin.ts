import { Role } from '../../types/auth';
import { getAuth } from '../../config/firebase';

export interface CreateAuthUserInput {
  email: string;
  displayName?: string;
}

/**
 * Privileged Firebase Auth operations. Abstracted behind an interface so the supervisor
 * service can be tested without Firebase.
 */
export interface AuthAdmin {
  /** Creates an Auth user with no password (set later via the invite email). */
  createUser(input: CreateAuthUserInput): Promise<{ uid: string }>;
  /** Sets the user's role as a custom claim (read back from the ID token). */
  setRole(uid: string, role: Role): Promise<void>;
}

export class FirebaseAuthAdmin implements AuthAdmin {
  async createUser({ email, displayName }: CreateAuthUserInput): Promise<{ uid: string }> {
    const user = await getAuth().createUser({ email, displayName });
    return { uid: user.uid };
  }

  async setRole(uid: string, role: Role): Promise<void> {
    await getAuth().setCustomUserClaims(uid, { role });
  }
}
