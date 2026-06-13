import { CounterRepository } from '../../repositories/counterRepository';
import { formatJobNumber, formatPoNumber, periodKey } from '../../utils/numbering';

const PO_SEQUENCE = 'po';
const JOB_SEQUENCE = 'jb';

/**
 * Produces the next PO / Job number for a given date, combining a transactional
 * monthly counter with the pure formatter. PO and Job have independent sequences.
 */
export class NumberingService {
  constructor(private readonly counters: CounterRepository) {}

  async nextPoNumber(date: Date): Promise<string> {
    const counter = await this.counters.next(PO_SEQUENCE, periodKey(date));
    return formatPoNumber(date, counter);
  }

  async nextJobNumber(date: Date): Promise<string> {
    return (await this.nextJobNumbers(date, 1))[0];
  }

  /**
   * Reserves `count` contiguous Job numbers in a SINGLE counter transaction and formats
   * them in order. Used for multi-item submissions so they don't hammer the counter doc.
   */
  async nextJobNumbers(date: Date, count: number): Promise<string[]> {
    const start = await this.counters.reserve(JOB_SEQUENCE, periodKey(date), count);
    return Array.from({ length: count }, (_, i) => formatJobNumber(date, start + i));
  }
}
