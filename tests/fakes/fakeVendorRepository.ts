import { Vendor } from '../../src/models/vendor';
import { Page, PageQuery } from '../../src/utils/pagination';
import {
  CreateVendorInput,
  VendorPatch,
  VendorRepository,
} from '../../src/repositories/vendorRepository';
import { byCreatedAtThenIdDesc, paginateSorted } from './pagination';

export class FakeVendorRepository implements VendorRepository {
  private readonly byId = new Map<string, Vendor>();
  private seq = 0;

  constructor(seed: Vendor[] = []) {
    seed.forEach((v) => this.byId.set(v.id, v));
  }

  async create(input: CreateVendorInput): Promise<Vendor> {
    const id = `vendor_${++this.seq}`;
    const vendor: Vendor = { id, ...input };
    this.byId.set(id, vendor);
    return vendor;
  }

  async findById(id: string): Promise<Vendor | null> {
    return this.byId.get(id) ?? null;
  }

  async findByIds(ids: string[]): Promise<Vendor[]> {
    return ids.map((id) => this.byId.get(id)).filter((v): v is Vendor => v != null);
  }

  async list(query: PageQuery = {}): Promise<Page<Vendor>> {
    const sorted = [...this.byId.values()].sort(byCreatedAtThenIdDesc);
    return paginateSorted(sorted, query.limit, query.cursor);
  }

  async update(id: string, patch: VendorPatch): Promise<Vendor | null> {
    const existing = this.byId.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...patch, id };
    this.byId.set(id, updated);
    return updated;
  }
}
