import { Clock, systemClock } from './utils/clock';
import { FirebaseTokenVerifier, TokenVerifier } from './services/auth/tokenVerifier';
import { AuthAdmin, FirebaseAuthAdmin } from './services/auth/authAdmin';
import { UserRepository } from './repositories/userRepository';
import { ProjectRepository } from './repositories/projectRepository';
import { WorkOrderRepository } from './repositories/workOrderRepository';
import { CounterRepository } from './repositories/counterRepository';
import { MaterialRequestRepository } from './repositories/materialRequestRepository';
import { VendorRepository } from './repositories/vendorRepository';
import { FirestoreUserRepository } from './repositories/firestore/userRepository';
import { FirestoreProjectRepository } from './repositories/firestore/projectRepository';
import { FirestoreWorkOrderRepository } from './repositories/firestore/workOrderRepository';
import { FirestoreCounterRepository } from './repositories/firestore/counterRepository';
import { FirestoreMaterialRequestRepository } from './repositories/firestore/materialRequestRepository';
import { FirestoreVendorRepository } from './repositories/firestore/vendorRepository';
import { NumberingService } from './services/numbering/numberingService';
import { SupervisorService } from './services/supervisor/supervisorService';
import { ProjectService } from './services/project/projectService';
import { WorkOrderService } from './services/workOrder/workOrderService';
import { MaterialRequestService } from './services/materialRequest/materialRequestService';
import { VendorService } from './services/vendor/vendorService';
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
  userRepository: UserRepository;
  projectRepository: ProjectRepository;
  workOrderRepository: WorkOrderRepository;
  counterRepository: CounterRepository;
  materialRequestRepository: MaterialRequestRepository;
  vendorRepository: VendorRepository;
  // Services
  numberingService: NumberingService;
  supervisorService: SupervisorService;
  projectService: ProjectService;
  workOrderService: WorkOrderService;
  materialRequestService: MaterialRequestService;
  vendorService: VendorService;
  storageService: StorageService;
}

export type ContainerOverrides = Partial<Container>;

export function createContainer(overrides: ContainerOverrides = {}): Container {
  const clock = overrides.clock ?? systemClock;
  const tokenVerifier = overrides.tokenVerifier ?? new FirebaseTokenVerifier();
  const authAdmin = overrides.authAdmin ?? new FirebaseAuthAdmin();
  const userRepository = overrides.userRepository ?? new FirestoreUserRepository();
  const projectRepository = overrides.projectRepository ?? new FirestoreProjectRepository();
  const workOrderRepository = overrides.workOrderRepository ?? new FirestoreWorkOrderRepository();
  const counterRepository = overrides.counterRepository ?? new FirestoreCounterRepository();
  const materialRequestRepository =
    overrides.materialRequestRepository ?? new FirestoreMaterialRequestRepository();
  const vendorRepository = overrides.vendorRepository ?? new FirestoreVendorRepository();

  const numberingService = overrides.numberingService ?? new NumberingService(counterRepository);
  const supervisorService =
    overrides.supervisorService ??
    new SupervisorService({ authAdmin, userRepository, workOrderRepository, clock });
  const projectService =
    overrides.projectService ??
    new ProjectService({
      projectRepository,
      workOrderRepository,
      userRepository,
      numberingService,
      clock,
    });
  const workOrderService =
    overrides.workOrderService ??
    new WorkOrderService({
      workOrderRepository,
      projectRepository,
      materialRequestRepository,
      userRepository,
      numberingService,
      clock,
    });
  const storageService = overrides.storageService ?? new FirebaseStorageService();
  const materialRequestService =
    overrides.materialRequestService ??
    new MaterialRequestService({
      materialRequestRepository,
      workOrderRepository,
      projectRepository,
      userRepository,
      vendorRepository,
      numberingService,
      storageService,
      clock,
    });
  const vendorService =
    overrides.vendorService ?? new VendorService({ vendorRepository, clock });

  return {
    clock,
    tokenVerifier,
    authAdmin,
    userRepository,
    projectRepository,
    workOrderRepository,
    counterRepository,
    materialRequestRepository,
    vendorRepository,
    numberingService,
    supervisorService,
    projectService,
    workOrderService,
    materialRequestService,
    vendorService,
    storageService,
  };
}
