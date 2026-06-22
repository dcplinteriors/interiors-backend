import { Project } from '../models/project';
import { WorkOrder } from '../models/workOrder';

/** API shape for a work order: the stored work order plus the parent project's name + number +
 * client name and the assigned supervisor's name, resolved at read time so clients don't look
 * them up. */
export interface WorkOrderView extends WorkOrder {
  projectName: string | null;
  projectNumber: string | null;
  clientName: string | null;
  supervisorName: string | null;
}

export function toWorkOrderView(
  workOrder: WorkOrder,
  projectsById: Map<string, Project>,
  supervisorNames: Map<string, string>,
): WorkOrderView {
  const project = projectsById.get(workOrder.project);
  return {
    ...workOrder,
    projectName: project?.name ?? null,
    projectNumber: project?.number ?? null,
    clientName: project?.clientName ?? null,
    supervisorName: workOrder.supervisorId
      ? supervisorNames.get(workOrder.supervisorId) ?? null
      : null,
  };
}
