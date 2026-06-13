import { Role } from '../../src/types/auth';
import { AuthAdmin, CreateAuthUserInput } from '../../src/services/auth/authAdmin';

export class FakeAuthAdmin implements AuthAdmin {
  public readonly created: { uid: string; email: string; displayName?: string }[] = [];
  public readonly roles = new Map<string, Role>();
  private seq = 0;

  async createUser({ email, displayName }: CreateAuthUserInput): Promise<{ uid: string }> {
    const uid = `uid_${++this.seq}`;
    this.created.push({ uid, email, displayName });
    return { uid };
  }

  async setRole(uid: string, role: Role): Promise<void> {
    this.roles.set(uid, role);
  }
}
