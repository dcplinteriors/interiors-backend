/** A source of "now" — injected so time-dependent logic is testable. */
export type Clock = () => Date;

export const systemClock: Clock = () => new Date();
