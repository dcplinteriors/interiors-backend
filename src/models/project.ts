export type ProjectStatus = 'active' | 'completed';

/**
 * An interior project / job. Created by an admin; has exactly one supervisor (once assigned).
 * `po` is the project's PO number, generated at creation and inherited by its material requests.
 */
export interface Project {
  id: string;
  particular: string;
  clientName: string;
  /** ISO date for the project. */
  date: string;
  /** Generated PO number, e.g. `PO_25-26_06/0001`. */
  po: string;
  /** Assigned supervisor's uid, or null until assigned. */
  supervisorId: string | null;
  status: ProjectStatus;
  /** ISO timestamp. */
  createdAt: string;
  /** uid of the admin who created the project. */
  createdBy: string;
}
