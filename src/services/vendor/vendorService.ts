import { AppError } from '../../utils/AppError';
import { Clock } from '../../utils/clock';
import { Vendor } from '../../models/vendor';
import { VendorRepository } from '../../repositories/vendorRepository';
import { Page, PageQuery } from '../../utils/pagination';

export interface CreateVendorInput {
  name: string;
  phone?: string;
  email?: string;
  /** Admin uid adding the vendor. */
  createdBy: string;
}

/** Partial update — only the provided fields change. `phone`/`email` accept `null` to clear;
 * `isActive` toggles the soft-delete (deactivate / reactivate). */
export interface UpdateVendorInput {
  name?: string;
  phone?: string | null;
  email?: string | null;
  isActive?: boolean;
}

export interface VendorServiceDeps {
  vendorRepository: VendorRepository;
  clock: Clock;
}

export class VendorService {
  constructor(private readonly deps: VendorServiceDeps) {}

  async create(input: CreateVendorInput): Promise<Vendor> {
    return this.deps.vendorRepository.create({
      name: input.name,
      phone: input.phone ?? null,
      email: input.email ?? null,
      isActive: true,
      createdAt: this.deps.clock().toISOString(),
      createdBy: input.createdBy,
    });
  }

  /** One cursor-paginated page of vendors (newest first), active and inactive alike. */
  async list(query: PageQuery = {}): Promise<Page<Vendor>> {
    return this.deps.vendorRepository.list(query);
  }

  async update(id: string, input: UpdateVendorInput): Promise<Vendor> {
    // Spread skips undefined keys, so only the provided fields are written.
    const updated = await this.deps.vendorRepository.update(id, {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.phone !== undefined && { phone: input.phone }),
      ...(input.email !== undefined && { email: input.email }),
      ...(input.isActive !== undefined && { isActive: input.isActive }),
    });
    if (!updated) throw new AppError(404, 'Vendor not found');
    return updated;
  }
}
