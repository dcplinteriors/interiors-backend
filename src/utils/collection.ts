/** Distinct, non-empty values, preserving first-seen order. Handy for collecting the
 * referenced ids/uids from a list before a batch lookup. */
export function uniqueDefined<T>(values: (T | null | undefined)[]): T[] {
  return [...new Set(values.filter((v): v is T => v != null && v !== ''))];
}
