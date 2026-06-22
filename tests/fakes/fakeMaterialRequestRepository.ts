import { MaterialRequest } from '../../src/models/materialRequest';
import { Page } from '../../src/utils/pagination';
import { byCreatedAtThenIdDesc, paginateSorted } from './pagination';
import {
  CreateMaterialRequestInput,
  MaterialRequestFilter,
  MaterialRequestPatch,
  MaterialRequestQuery,
  MaterialRequestRepository,
} from '../../src/repositories/materialRequestRepository';

export class FakeMaterialRequestRepository implements MaterialRequestRepository {
  private readonly byId = new Map<string, MaterialRequest>();
  private seq = 0;

  constructor(seed: MaterialRequest[] = []) {
    seed.forEach((r) => this.byId.set(r.id, r));
  }

  async createMany(inputs: CreateMaterialRequestInput[]): Promise<MaterialRequest[]> {
    return inputs.map((input) => {
      const id = `mr_${++this.seq}`;
      const record: MaterialRequest = { id, ...input };
      this.byId.set(id, record);
      return record;
    });
  }

  async findById(id: string): Promise<MaterialRequest | null> {
    return this.byId.get(id) ?? null;
  }

  async findByWorkOrder(workOrderId: string): Promise<MaterialRequest[]> {
    return [...this.byId.values()]
      .filter((r) => r.workOrder === workOrderId)
      .sort(byCreatedAtThenIdDesc);
  }

  async list(query: MaterialRequestQuery = {}): Promise<Page<MaterialRequest>> {
    return paginateSorted(this.applyQuery([...this.byId.values()], query), query.limit, query.cursor);
  }

  async listBySupervisor(
    supervisorId: string,
    query: MaterialRequestQuery = {},
  ): Promise<Page<MaterialRequest>> {
    const own = [...this.byId.values()].filter((r) => r.supervisorId === supervisorId);
    return paginateSorted(this.applyQuery(own, query), query.limit, query.cursor);
  }

  async count(filter: MaterialRequestFilter = {}): Promise<number> {
    return this.applyQuery([...this.byId.values()], filter).length;
  }

  async countBySupervisor(supervisorId: string, filter: MaterialRequestFilter = {}): Promise<number> {
    const own = [...this.byId.values()].filter((r) => r.supervisorId === supervisorId);
    return this.applyQuery(own, filter).length;
  }

  async update(id: string, patch: MaterialRequestPatch): Promise<MaterialRequest | null> {
    const existing = this.byId.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...patch, id };
    this.byId.set(id, updated);
    return updated;
  }

  async updateMany(updates: { id: string; patch: MaterialRequestPatch }[]): Promise<void> {
    for (const { id, patch } of updates) {
      const existing = this.byId.get(id);
      if (existing) this.byId.set(id, { ...existing, ...patch, id });
    }
  }

  async transition(
    id: string,
    decide: (current: MaterialRequest) => MaterialRequestPatch,
  ): Promise<MaterialRequest | null> {
    const existing = this.byId.get(id);
    if (!existing) return null;
    const patch = decide(existing); // validates; throws to abort
    const updated = { ...existing, ...patch, id };
    this.byId.set(id, updated);
    return updated;
  }

  private applyQuery(
    items: MaterialRequest[],
    query: MaterialRequestQuery & MaterialRequestFilter,
  ): MaterialRequest[] {
    return items
      .filter(
        (r) =>
          (query.statusIn !== undefined
            ? query.statusIn.includes(r.status)
            : query.status === undefined || r.status === query.status) &&
          (query.project === undefined || r.project === query.project) &&
          (query.workOrder === undefined || r.workOrder === query.workOrder),
      )
      .sort(byCreatedAtThenIdDesc);
  }
}
