import { WorkOrderStatus } from '../../models/workOrder';

export type WorkOrderAction = 'complete' | 'cancel';

export interface WorkOrderTransition {
  from: WorkOrderStatus[];
  to: WorkOrderStatus;
}

/**
 * The plain status moves for a work order (ADR-0006). `assign`/`unassign` also mutate
 * `supervisorId` (and `assign` may trigger a reassignment sweep), so the service handles those
 * directly rather than through this table.
 *
 *   pending ─assign→ active ─complete→ completed   (gate: no open items)
 *      │ └─unassign─┘
 *      └─ cancel → cancelled   (a still-unassigned work order the admin no longer needs)
 */
export const WORK_ORDER_TRANSITIONS: Record<WorkOrderAction, WorkOrderTransition> = {
  complete: { from: ['active'], to: 'completed' },
  cancel: { from: ['pending'], to: 'cancelled' },
};

/** A work order counts toward project completion only when it's in one of these terminal states. */
export const WORK_ORDER_TERMINAL: readonly WorkOrderStatus[] = ['completed', 'cancelled'];

export const isWorkOrderTerminal = (status: WorkOrderStatus): boolean =>
  WORK_ORDER_TERMINAL.includes(status);
