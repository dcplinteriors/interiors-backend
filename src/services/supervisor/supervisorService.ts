import { AppError } from '../../utils/AppError';
import { Clock } from '../../utils/clock';
import { UserRecord } from '../../models/user';
import { ProjectRepository } from '../../repositories/projectRepository';
import { UserRepository } from '../../repositories/userRepository';
import { SupervisorView, toSupervisorView } from '../../views/supervisorView';
import { Page, PageQuery } from '../../utils/pagination';
import { AuthAdmin } from '../auth/authAdmin';
import { InviteEmailService } from '../email/inviteEmailService';

export interface CreateSupervisorInput {
  name: string;
  email: string;
  phone?: string;
  /** Admin uid creating the account. */
  createdBy: string;
}

export interface SupervisorServiceDeps {
  authAdmin: AuthAdmin;
  userRepository: UserRepository;
  projectRepository: ProjectRepository;
  inviteEmail: InviteEmailService;
  clock: Clock;
}

export class SupervisorService {
  constructor(private readonly deps: SupervisorServiceDeps) {}

  /**
   * Creates a supervisor: Firebase Auth user → role claim → `users` record → invite email.
   */
  async create(input: CreateSupervisorInput): Promise<SupervisorView> {
    // Normalize email so dedup, the Auth user, and the stored record agree (Firestore
    // queries are case-sensitive, so we store and compare a single canonical form).
    const email = input.email.trim().toLowerCase();

    const existing = await this.deps.userRepository.findByEmail(email);
    if (existing) {
      throw new AppError(409, 'A user with this email already exists');
    }

    let uid: string;
    try {
      ({ uid } = await this.deps.authAdmin.createUser({ email, displayName: input.name }));
    } catch (err) {
      // The email can exist in Firebase Auth without a `users` record (e.g. a prior partial
      // run); surface that as a clear 409 instead of an opaque 500.
      if ((err as { code?: string }).code === 'auth/email-already-exists') {
        throw new AppError(409, 'A user with this email already exists');
      }
      throw err;
    }
    await this.deps.authAdmin.setRole(uid, 'supervisor');

    const record: UserRecord = {
      uid,
      role: 'supervisor',
      name: input.name,
      email,
      phone: input.phone,
      isActive: true,
      createdAt: this.deps.clock().toISOString(),
      createdBy: input.createdBy,
      mustChangePassword: true,
    };
    await this.deps.userRepository.create(record);

    await this.deps.inviteEmail.sendSetPasswordEmail(email);

    // A brand-new supervisor has no projects yet.
    return { ...record, projects: [] };
  }

  /** One cursor-paginated page of supervisors, each with the names of their assigned projects. */
  async list(query: PageQuery = {}): Promise<Page<SupervisorView>> {
    const page = await this.deps.userRepository.listByRole('supervisor', query);
    const projectsByUid = await this.projectsBySupervisor(page.items.map((s) => s.uid));
    return {
      items: page.items.map((s) => toSupervisorView(s, projectsByUid)),
      nextCursor: page.nextCursor,
    };
  }

  /** supervisor uid → names of their assigned projects, scoped to [uids] (one batched query). */
  private async projectsBySupervisor(uids: string[]): Promise<Map<string, string[]>> {
    const projects = await this.deps.projectRepository.findBySupervisorIds(uids);
    const byUid = new Map<string, string[]>();
    for (const p of projects) {
      if (!p.supervisorId) continue;
      const names = byUid.get(p.supervisorId) ?? [];
      names.push(p.particular);
      byUid.set(p.supervisorId, names);
    }
    return byUid;
  }
}
