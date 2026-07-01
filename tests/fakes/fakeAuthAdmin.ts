import { Role } from '../../src/types/auth';
import { AuthAdmin, CreateAuthUserInput } from '../../src/services/auth/authAdmin';

export class FakeAuthAdmin implements AuthAdmin {
  public readonly created: { uid: string; email: string; password: string; displayName?: string }[] =
    [];
  public readonly roles = new Map<string, Role>();
  /** uid → current password (initial create password, then any reset). */
  public readonly passwords = new Map<string, string>();
  public readonly revoked: string[] = [];
  private seq = 0;

  async createUser({ email, password, displayName }: CreateAuthUserInput): Promise<{ uid: string }> {
    const uid = `uid_${++this.seq}`;
    this.created.push({ uid, email, password, displayName });
    this.passwords.set(uid, password);
    return { uid };
  }

  async setRole(uid: string, role: Role): Promise<void> {
    this.roles.set(uid, role);
  }

  async setPassword(uid: string, password: string): Promise<void> {
    this.passwords.set(uid, password);
  }

  async revokeRefreshTokens(uid: string): Promise<void> {
    this.revoked.push(uid);
  }
}
