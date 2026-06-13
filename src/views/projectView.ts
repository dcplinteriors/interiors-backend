import { Project } from '../models/project';

/** API shape for a project: the stored project plus the assigned supervisor's display
 * name, resolved at read time so clients don't have to look it up. */
export interface ProjectView extends Project {
  /** Assigned supervisor's name, or null when unassigned / unknown. */
  supervisorName: string | null;
}

export function toProjectView(project: Project, supervisorNames: Map<string, string>): ProjectView {
  return {
    ...project,
    supervisorName: project.supervisorId ? supervisorNames.get(project.supervisorId) ?? null : null,
  };
}
