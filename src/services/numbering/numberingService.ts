import { CounterRepository } from '../../repositories/counterRepository';
import {
  financialYear,
  formatItemNumber,
  formatProjectNumber,
  formatWorkOrderNumber,
} from '../../utils/numbering';

const PROJECT_SEQUENCE = 'project';
const WORK_ORDER_SEQUENCE = 'workOrder';
const ITEM_SEQUENCE = 'item';

/**
 * Hierarchical, financial-year-aware number generation, combining the transactional counters
 * with the pure formatters. Three independent counter scopes (the `periodKey` is the reset
 * boundary):
 *
 *   - project number    resets per financial year   (period = FY, e.g. `26-27`)
 *   - work-order number resets per project          (period = projectId)
 *   - item number       resets per work order        (period = workOrderId)
 */
export class NumberingService {
  constructor(private readonly counters: CounterRepository) {}

  /** Next project number for `date`, e.g. `26-27_0001`. */
  async nextProjectNumber(date: Date): Promise<string> {
    const counter = await this.counters.next(PROJECT_SEQUENCE, financialYear(date));
    return formatProjectNumber(date, counter);
  }

  /**
   * Reserves `count` contiguous work-order numbers under one project in a SINGLE counter
   * transaction (so creating a project with N work orders is one counter write, not N), and
   * formats them in order as `<projectNumber>/NNNN`.
   */
  async nextWorkOrderNumbers(
    projectId: string,
    projectNumber: string,
    count: number,
  ): Promise<string[]> {
    const start = await this.counters.reserve(WORK_ORDER_SEQUENCE, projectId, count);
    return Array.from({ length: count }, (_, i) =>
      formatWorkOrderNumber(projectNumber, start + i),
    );
  }

  /** Adds a single work order to an existing project. */
  async nextWorkOrderNumber(projectId: string, projectNumber: string): Promise<string> {
    return (await this.nextWorkOrderNumbers(projectId, projectNumber, 1))[0];
  }

  /**
   * Reserves `count` contiguous item numbers under one work order in a SINGLE counter
   * transaction (a multi-item submission is one counter write, not N), formatted
   * `<workOrderNumber>/NNNN`.
   */
  async nextItemNumbers(
    workOrderId: string,
    workOrderNumber: string,
    count: number,
  ): Promise<string[]> {
    const start = await this.counters.reserve(ITEM_SEQUENCE, workOrderId, count);
    return Array.from({ length: count }, (_, i) => formatItemNumber(workOrderNumber, start + i));
  }
}
