import { UserRecord } from '../models/user';

/** API shape for a supervisor: the stored user record plus the names of the work orders
 * currently assigned to them, resolved at read time. */
export interface SupervisorView extends UserRecord {
  workOrders: string[];
}

export function toSupervisorView(
  supervisor: UserRecord,
  workOrderNamesByUid: Map<string, string[]>,
): SupervisorView {
  return { ...supervisor, workOrders: workOrderNamesByUid.get(supervisor.uid) ?? [] };
}
