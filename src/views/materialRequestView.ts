import { MaterialRequest } from '../models/materialRequest';
import { Project } from '../models/project';
import { WorkOrder } from '../models/workOrder';

/** API shape for a material request: the stored item plus its work order's and project's
 * name + number, the client name, and the assigned supervisor's name, resolved at read time. */
export interface MaterialRequestView extends MaterialRequest {
  workOrderName: string | null;
  workOrderNumber: string | null;
  projectName: string | null;
  projectNumber: string | null;
  clientName: string | null;
  supervisorName: string | null;
}

export function toMaterialRequestView(
  request: MaterialRequest,
  projectsById: Map<string, Project>,
  workOrdersById: Map<string, WorkOrder>,
  supervisorNames: Map<string, string>,
): MaterialRequestView {
  const project = projectsById.get(request.project);
  const workOrder = workOrdersById.get(request.workOrder);
  return {
    ...request,
    workOrderName: workOrder?.name ?? null,
    workOrderNumber: workOrder?.number ?? null,
    projectName: project?.name ?? null,
    projectNumber: project?.number ?? null,
    clientName: project?.clientName ?? null,
    // The CURRENT assignee (supervisorId) — who the item is now visible to / responsible for
    // (null once the work order is unassigned).
    supervisorName: request.supervisorId
      ? supervisorNames.get(request.supervisorId) ?? null
      : null,
  };
}
