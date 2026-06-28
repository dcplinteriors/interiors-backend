/**
 * A supplier the admin assigns to material requests. A managed directory entry with no login —
 * deliberately a standalone collection rather than a `users` record, so it can later be promoted
 * to a full auth user type without restructuring.
 */
export interface Vendor {
  id: string;
  name: string;
  /** Optional contact details. The backend supports them, but the current Admin UI only collects
   * the name — they're here so we can surface the inputs later without a model change. */
  phone?: string | null;
  email?: string | null;
  /** Soft delete: a deactivated vendor stays for history but drops out of the assign-vendor
   * picker. Never hard-deleted (past requests reference it). */
  isActive: boolean;
  /** ISO timestamp. */
  createdAt: string;
  /** uid of the admin who added the vendor. */
  createdBy: string;
}
