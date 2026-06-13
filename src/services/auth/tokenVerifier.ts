import { Role } from '../../types/auth';
import { getAuth } from '../../config/firebase';

export interface DecodedToken {
  uid: string;
  email?: string;
  role?: Role;
}

/**
 * Verifies a client ID token. Abstracted behind an interface so the auth
 * middleware can be tested without Firebase.
 */
export interface TokenVerifier {
  verify(idToken: string): Promise<DecodedToken>;
}

/** Real verifier backed by the Firebase Admin SDK. Role is read from a custom claim. */
export class FirebaseTokenVerifier implements TokenVerifier {
  async verify(idToken: string): Promise<DecodedToken> {
    const decoded = await getAuth().verifyIdToken(idToken);
    return {
      uid: decoded.uid,
      email: decoded.email,
      role: decoded.role as Role | undefined,
    };
  }
}
