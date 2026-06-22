export type WorkOrderStatus = 'pending' | 'active' | 'completed' | 'cancelled';

/**
 * A work order under a project — the unit a supervisor is assigned to and raises material
 * requests against. Created by an admin (with the project, or added later).
 *
 *   pending   created, no supervisor yet
 *   active    a supervisor is assigned (set automatically on assign)
 *   completed admin-closed once no item is still open
 *   cancelled admin discards a still-`pending` work order it no longer needs (terminal)
 */
export interface WorkOrder {
  id: string;
  /** Parent project id. */
  project: string;
  /** System-generated, e.g. `26-27_0001/0001`. */
  number: string;
  name: string;
  /** ISO date (YYYY-MM-DD) on the work order. */
  date: string;
  /** Optional free-text description. */
  description?: string | null;
  /** Assigned supervisor's uid, or null until assigned. */
  supervisorId: string | null;
  status: WorkOrderStatus;
  /** ISO timestamp. */
  createdAt: string;
  /** uid of the admin who created it. */
  createdBy: string;
}
