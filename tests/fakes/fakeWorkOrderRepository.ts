import { WorkOrder } from '../../src/models/workOrder';
import { Page } from '../../src/utils/pagination';
import {
  CreateWorkOrderInput,
  WorkOrderPatch,
  WorkOrderQuery,
  WorkOrderRepository,
} from '../../src/repositories/workOrderRepository';
import { byCreatedAtThenIdDesc, paginateSorted } from './pagination';

export class FakeWorkOrderRepository implements WorkOrderRepository {
  private readonly byId = new Map<string, WorkOrder>();
  private seq = 0;

  constructor(seed: WorkOrder[] = []) {
    seed.forEach((w) => this.byId.set(w.id, w));
  }

  async create(input: CreateWorkOrderInput): Promise<WorkOrder> {
    const id = `wo_${++this.seq}`;
    const wo: WorkOrder = { id, ...input };
    this.byId.set(id, wo);
    return wo;
  }

  async createMany(inputs: CreateWorkOrderInput[]): Promise<WorkOrder[]> {
    return inputs.map((input) => {
      const id = `wo_${++this.seq}`;
      const wo: WorkOrder = { id, ...input };
      this.byId.set(id, wo);
      return wo;
    });
  }

  async findById(id: string): Promise<WorkOrder | null> {
    return this.byId.get(id) ?? null;
  }

  async findByIds(ids: string[]): Promise<WorkOrder[]> {
    return ids.map((id) => this.byId.get(id)).filter((w): w is WorkOrder => w != null);
  }

  async findByProject(projectId: string): Promise<WorkOrder[]> {
    return this.sorted([...this.byId.values()].filter((w) => w.project === projectId));
  }

  async findByProjectIds(projectIds: string[]): Promise<WorkOrder[]> {
    const wanted = new Set(projectIds);
    return this.sorted([...this.byId.values()].filter((w) => wanted.has(w.project)));
  }

  async findBySupervisorIds(supervisorIds: string[]): Promise<WorkOrder[]> {
    const wanted = new Set(supervisorIds);
    return this.sorted(
      [...this.byId.values()].filter((w) => w.supervisorId != null && wanted.has(w.supervisorId)),
    );
  }

  async list(query: WorkOrderQuery = {}): Promise<Page<WorkOrder>> {
    return paginateSorted(this.applyQuery([...this.byId.values()], query), query.limit, query.cursor);
  }

  async listBySupervisor(
    supervisorId: string,
    query: WorkOrderQuery = {},
  ): Promise<Page<WorkOrder>> {
    const own = [...this.byId.values()].filter((w) => w.supervisorId === supervisorId);
    return paginateSorted(this.applyQuery(own, query), query.limit, query.cursor);
  }

  async update(id: string, patch: WorkOrderPatch): Promise<WorkOrder | null> {
    const existing = this.byId.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...patch, id };
    this.byId.set(id, updated);
    return updated;
  }

  async transition(
    id: string,
    decide: (current: WorkOrder) => WorkOrderPatch,
  ): Promise<WorkOrder | null> {
    const existing = this.byId.get(id);
    if (!existing) return null;
    const patch = decide(existing); // validates; throws to abort
    const updated = { ...existing, ...patch, id };
    this.byId.set(id, updated);
    return updated;
  }

  private applyQuery(items: WorkOrder[], query: WorkOrderQuery): WorkOrder[] {
    return this.sorted(
      items.filter(
        (w) =>
          (query.project === undefined || w.project === query.project) &&
          (query.status === undefined || w.status === query.status),
      ),
    );
  }

  private sorted(items: WorkOrder[]): WorkOrder[] {
    return items.sort(byCreatedAtThenIdDesc);
  }
}
