import { UserRecord } from '../models/user';

/** API shape for a supervisor: the stored user record plus the names of the projects
 * assigned to them, resolved at read time. */
export interface SupervisorView extends UserRecord {
  projects: string[];
}

export function toSupervisorView(
  supervisor: UserRecord,
  projectsByUid: Map<string, string[]>,
): SupervisorView {
  return { ...supervisor, projects: projectsByUid.get(supervisor.uid) ?? [] };
}
