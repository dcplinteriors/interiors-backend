/** Persistence port for monotonic counters backing PO/Job number generation. */
export interface CounterRepository {
  /**
   * Atomically increments and returns the next value for a (sequence, periodKey) pair.
   * The first call for a given pair returns 1.
   *
   * @param sequence  e.g. 'po' or 'jb'
   * @param periodKey e.g. '25-26_06' (financial year + month) — counters reset per period
   */
  next(sequence: string, periodKey: string): Promise<number>;

  /**
   * Atomically reserves a contiguous block of `count` values in a SINGLE transaction and
   * returns the FIRST value of the block (so the block is [first, first+count-1]). This keeps
   * a multi-item submission to one write on the hot counter doc instead of N, avoiding
   * Firestore's ~1 write/sec/doc contention under concurrent or large submissions.
   * `next` is equivalent to `reserve(sequence, periodKey, 1)`.
   */
  reserve(sequence: string, periodKey: string, count: number): Promise<number>;
}
