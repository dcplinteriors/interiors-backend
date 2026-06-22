import { Project } from '../models/project';
import { WorkOrderView } from './workOrderView';

/** API shape for a project in a list: the stored project plus a count of its work orders,
 * resolved at read time. (A project has no supervisor of its own — that's per work order.) */
export interface ProjectListItem extends Project {
  workOrderCount: number;
}

export function toProjectListItem(project: Project, workOrderCount: number): ProjectListItem {
  return { ...project, workOrderCount };
}

/** API shape for a single project: the stored project plus its work orders (each already
 * enriched with names). */
export interface ProjectDetail extends Project {
  workOrders: WorkOrderView[];
}

export function toProjectDetail(project: Project, workOrders: WorkOrderView[]): ProjectDetail {
  return { ...project, workOrders };
}
