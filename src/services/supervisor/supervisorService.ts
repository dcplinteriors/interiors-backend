import { AppError } from '../../utils/AppError';
import { Clock } from '../../utils/clock';
import { UserRecord } from '../../models/user';
import { WorkOrderRepository } from '../../repositories/workOrderRepository';
import { UserRepository } from '../../repositories/userRepository';
import { SupervisorView, toSupervisorView } from '../../views/supervisorView';
import { Page, PageQuery } from '../../utils/pagination';
import { AuthAdmin } from '../auth/authAdmin';
import { normalizePhone, syntheticEmail } from '../../utils/phone';
import { generateTempPassword } from '../../utils/password';

export interface CreateSupervisorInput {
  name: string;
  /** 10-digit (or `91`-prefixed) phone; normalized into the login identity. */
  phone: string;
  /** Admin uid creating the account. */
  createdBy: string;
}

/** A freshly-created supervisor plus the one-time password the admin must hand over. */
export interface CreateSupervisorResult extends SupervisorView {
  tempPassword: string;
}

export interface SupervisorServiceDeps {
  authAdmin: AuthAdmin;
  userRepository: UserRepository;
  workOrderRepository: WorkOrderRepository;
  clock: Clock;
}

export class SupervisorService {
  constructor(private readonly deps: SupervisorServiceDeps) {}

  /**
   * Creates a supervisor: phone → synthetic email + temp password → Firebase Auth user →
   * role claim → `users` record (flagged `mustChangePassword`). Returns the view plus the
   * one-time temp password for the admin to relay.
   */
  async create(input: CreateSupervisorInput): Promise<CreateSupervisorResult> {
    // Phone+password auth is backed by a synthetic email; normalize once so the Auth user,
    // the stored record, and dedup all agree on a single canonical form.
    const email = syntheticEmail(input.phone);
    const phone = normalizePhone(input.phone);
    if (!email || !phone) {
      throw new AppError(400, 'Invalid phone number');
    }

    const existing = await this.deps.userRepository.findByEmail(email);
    if (existing) {
      throw new AppError(409, 'A supervisor with this phone already exists');
    }

    const tempPassword = generateTempPassword();

    let uid: string;
    try {
      ({ uid } = await this.deps.authAdmin.createUser({
        email,
        password: tempPassword,
        displayName: input.name,
      }));
    } catch (err) {
      if ((err as { code?: string }).code === 'auth/email-already-exists') {
        throw new AppError(409, 'A supervisor with this phone already exists');
      }
      throw err;
    }
    await this.deps.authAdmin.setRole(uid, 'supervisor');

    const record: UserRecord = {
      uid,
      role: 'supervisor',
      name: input.name,
      email,
      phone,
      isActive: true,
      createdAt: this.deps.clock().toISOString(),
      createdBy: input.createdBy,
      mustChangePassword: true,
    };
    await this.deps.userRepository.create(record);

    // A brand-new supervisor has no work orders yet.
    return { ...record, workOrders: [], tempPassword };
  }

  /**
   * Resets a supervisor's password to a fresh temp one: revokes existing sessions and re-flags
   * `mustChangePassword`. Returns the temp password for the admin to relay.
   */
  async resetPassword(uid: string): Promise<{ tempPassword: string }> {
    const user = await this.deps.userRepository.findByUid(uid);
    if (!user || user.role !== 'supervisor') {
      throw new AppError(404, 'Supervisor not found');
    }

    const tempPassword = generateTempPassword();
    await this.deps.authAdmin.setPassword(uid, tempPassword);
    await this.deps.authAdmin.revokeRefreshTokens(uid);
    await this.deps.userRepository.update(uid, { mustChangePassword: true });

    return { tempPassword };
  }

  /** One cursor-paginated page of supervisors, each with the names of their assigned work orders. */
  async list(query: PageQuery = {}): Promise<Page<SupervisorView>> {
    const page = await this.deps.userRepository.listByRole('supervisor', query);
    const workOrdersByUid = await this.workOrdersBySupervisor(page.items.map((s) => s.uid));
    return {
      items: page.items.map((s) => toSupervisorView(s, workOrdersByUid)),
      nextCursor: page.nextCursor,
    };
  }

  /** supervisor uid → names of the work orders assigned to them, scoped to [uids] (one batched query). */
  private async workOrdersBySupervisor(uids: string[]): Promise<Map<string, string[]>> {
    const workOrders = await this.deps.workOrderRepository.findBySupervisorIds(uids);
    const byUid = new Map<string, string[]>();
    for (const w of workOrders) {
      if (!w.supervisorId) continue;
      const names = byUid.get(w.supervisorId) ?? [];
      names.push(w.name);
      byUid.set(w.supervisorId, names);
    }
    return byUid;
  }
}
