import {
  WORK_ORDER_TRANSITIONS,
  WORK_ORDER_TERMINAL,
  isWorkOrderTerminal,
} from '../../src/services/workOrder/workOrder.stateMachine';

describe('work-order state machine', () => {
  it('defines complete (active→completed) and cancel (pending→cancelled)', () => {
    expect(WORK_ORDER_TRANSITIONS).toEqual({
      complete: { from: ['active'], to: 'completed' },
      cancel: { from: ['pending'], to: 'cancelled' },
    });
  });

  it('only completes an active work order', () => {
    expect(WORK_ORDER_TRANSITIONS.complete.from).toEqual(['active']);
  });

  it('only cancels a still-pending work order', () => {
    expect(WORK_ORDER_TRANSITIONS.cancel.from).toEqual(['pending']);
  });

  it('counts completed and cancelled as terminal for the project gate', () => {
    expect([...WORK_ORDER_TERMINAL]).toEqual(['completed', 'cancelled']);
    expect(isWorkOrderTerminal('completed')).toBe(true);
    expect(isWorkOrderTerminal('cancelled')).toBe(true);
    expect(isWorkOrderTerminal('pending')).toBe(false);
    expect(isWorkOrderTerminal('active')).toBe(false);
  });
});
