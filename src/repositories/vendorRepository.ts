import { Vendor } from '../models/vendor';
import { Page, PageQuery } from '../utils/pagination';

export type CreateVendorInput = Omit<Vendor, 'id'>;
export type VendorPatch = Partial<Omit<Vendor, 'id'>>;

/** Persistence port for `vendors`. */
export interface VendorRepository {
  create(input: CreateVendorInput): Promise<Vendor>;
  findById(id: string): Promise<Vendor | null>;
  /** Batch fetch by id (one round trip); missing ids are simply absent from the result. Used to
   * resolve the vendor name when enriching requests. */
  findByIds(ids: string[]): Promise<Vendor[]>;
  /** Cursor-paginated admin list (newest first). */
  list(query?: PageQuery): Promise<Page<Vendor>>;
  update(id: string, patch: VendorPatch): Promise<Vendor | null>;
}
