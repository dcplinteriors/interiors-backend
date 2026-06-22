export type ProjectStatus = 'active' | 'completed';

/**
 * An interior project. Created by an admin together with its work orders. Supervisors are
 * assigned at the WORK-ORDER level, not here, so a project has no supervisor of its own.
 */
export interface Project {
  id: string;
  /** System-generated at creation, e.g. `26-27_0001`. */
  number: string;
  name: string;
  clientName: string;
  /** The project engineer's name — free text, not a user account. */
  projectEngineer: string;
  /** `active` until the admin marks it `completed` (gated on every work order being
   * `completed` or `cancelled`). */
  status: ProjectStatus;
  /** ISO timestamp. */
  createdAt: string;
  /** uid of the admin who created the project. */
  createdBy: string;
}
