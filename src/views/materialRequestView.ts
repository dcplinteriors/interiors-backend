import { MaterialRequest } from '../models/materialRequest';
import { Project } from '../models/project';

/** API shape for a material request: the stored request plus the project's name + client
 * name and the ordering supervisor's name, resolved at read time. */
export interface MaterialRequestView extends MaterialRequest {
  projectName: string | null;
  clientName: string | null;
  supervisorName: string | null;
}

export function toMaterialRequestView(
  request: MaterialRequest,
  projectsById: Map<string, Project>,
  supervisorNames: Map<string, string>,
): MaterialRequestView {
  const project = projectsById.get(request.project);
  return {
    ...request,
    projectName: project?.particular ?? null,
    clientName: project?.clientName ?? null,
    supervisorName: supervisorNames.get(request.orderBy) ?? null,
  };
}
