import { MaterialRequest } from '../../src/models/materialRequest';
import { Page } from '../../src/utils/pagination';
import { byCreatedAtThenIdDesc, paginateSorted } from './pagination';
import {
  CreateMaterialRequestInput,
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

  async list(query: MaterialRequestQuery = {}): Promise<Page<MaterialRequest>> {
    return paginateSorted(this.applyQuery([...this.byId.values()], query), query.limit, query.cursor);
  }

  async listBySupervisor(
    supervisorId: string,
    query: MaterialRequestQuery = {},
  ): Promise<Page<MaterialRequest>> {
    const own = [...this.byId.values()].filter((r) => r.orderBy === supervisorId);
    return paginateSorted(this.applyQuery(own, query), query.limit, query.cursor);
  }

  async update(id: string, patch: MaterialRequestPatch): Promise<MaterialRequest | null> {
    const existing = this.byId.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...patch, id };
    this.byId.set(id, updated);
    return updated;
  }

  private applyQuery(items: MaterialRequest[], query: MaterialRequestQuery): MaterialRequest[] {
    return items
      .filter(
        (r) =>
          (query.status === undefined || r.status === query.status) &&
          (query.project === undefined || r.project === query.project),
      )
      .sort(byCreatedAtThenIdDesc);
  }
}
