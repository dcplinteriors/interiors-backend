import { Clock, systemClock } from './utils/clock';
import { FirebaseTokenVerifier, TokenVerifier } from './services/auth/tokenVerifier';
import { AuthAdmin, FirebaseAuthAdmin } from './services/auth/authAdmin';
import {
  FirebaseInviteEmailService,
  InviteEmailService,
} from './services/email/inviteEmailService';
import { UserRepository } from './repositories/userRepository';
import { ProjectRepository } from './repositories/projectRepository';
import { CounterRepository } from './repositories/counterRepository';
import { MaterialRequestRepository } from './repositories/materialRequestRepository';
import { FirestoreUserRepository } from './repositories/firestore/userRepository';
import { FirestoreProjectRepository } from './repositories/firestore/projectRepository';
import { FirestoreCounterRepository } from './repositories/firestore/counterRepository';
import { FirestoreMaterialRequestRepository } from './repositories/firestore/materialRequestRepository';
import { NumberingService } from './services/numbering/numberingService';
import { SupervisorService } from './services/supervisor/supervisorService';
import { ProjectService } from './services/project/projectService';
import { MaterialRequestService } from './services/materialRequest/materialRequestService';
import { FirebaseStorageService, StorageService } from './services/storage/storageService';

/**
 * Composition root. Leaf dependencies (verifier, repositories, ports, clock) are injectable
 * so tests can swap in fakes; services are built from the resolved leaves, so overriding a
 * repository transparently affects the service that uses it.
 *
 * Grows as features are added.
 */
export interface Container {
  // Leaf dependencies
  clock: Clock;
  tokenVerifier: TokenVerifier;
  authAdmin: AuthAdmin;
  inviteEmail: InviteEmailService;
  userRepository: UserRepository;
  projectRepository: ProjectRepository;
  counterRepository: CounterRepository;
  materialRequestRepository: MaterialRequestRepository;
  // Services
  numberingService: NumberingService;
  supervisorService: SupervisorService;
  projectService: ProjectService;
  materialRequestService: MaterialRequestService;
  storageService: StorageService;
}

export type ContainerOverrides = Partial<Container>;

export function createContainer(overrides: ContainerOverrides = {}): Container {
  const clock = overrides.clock ?? systemClock;
  const tokenVerifier = overrides.tokenVerifier ?? new FirebaseTokenVerifier();
  const authAdmin = overrides.authAdmin ?? new FirebaseAuthAdmin();
  const inviteEmail = overrides.inviteEmail ?? new FirebaseInviteEmailService();
  const userRepository = overrides.userRepository ?? new FirestoreUserRepository();
  const projectRepository = overrides.projectRepository ?? new FirestoreProjectRepository();
  const counterRepository = overrides.counterRepository ?? new FirestoreCounterRepository();
  const materialRequestRepository =
    overrides.materialRequestRepository ?? new FirestoreMaterialRequestRepository();

  const numberingService = overrides.numberingService ?? new NumberingService(counterRepository);
  const supervisorService =
    overrides.supervisorService ??
    new SupervisorService({ authAdmin, userRepository, projectRepository, inviteEmail, clock });
  const projectService =
    overrides.projectService ??
    new ProjectService({ projectRepository, userRepository, numberingService, clock });
  const materialRequestService =
    overrides.materialRequestService ??
    new MaterialRequestService({
      materialRequestRepository,
      projectRepository,
      userRepository,
      numberingService,
      clock,
    });
  const storageService = overrides.storageService ?? new FirebaseStorageService();

  return {
    clock,
    tokenVerifier,
    authAdmin,
    inviteEmail,
    userRepository,
    projectRepository,
    counterRepository,
    materialRequestRepository,
    numberingService,
    supervisorService,
    projectService,
    materialRequestService,
    storageService,
  };
}
