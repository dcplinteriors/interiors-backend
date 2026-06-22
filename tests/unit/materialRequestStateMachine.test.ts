import {
  MATERIAL_REQUEST_TRANSITIONS,
  OPEN_STATUSES,
  SUPERSEDABLE_STATUSES,
  isOpen,
} from '../../src/services/materialRequest/materialRequest.stateMachine';
import { MaterialRequestStatus } from '../../src/models/materialRequest';

const ALL_STATUSES: MaterialRequestStatus[] = [
  'requested',
  'processing',
  'accepted',
  'closed',
  'returned',
  'declined',
  'cancelled',
  'superseded',
];

describe('material-request state machine', () => {
  it('defines exactly the expected transitions (from → to, actor)', () => {
    expect(MATERIAL_REQUEST_TRANSITIONS).toEqual({
      accept: { from: ['requested'], to: 'processing', actor: 'admin' },
      assignVendor: { from: ['processing'], to: 'accepted', actor: 'admin' },
      decline: { from: ['requested', 'processing'], to: 'declined', actor: 'admin' },
      cancel: { from: ['requested'], to: 'cancelled', actor: 'owner' },
      close: { from: ['accepted'], to: 'closed', actor: 'assignee' },
      return: { from: ['accepted'], to: 'returned', actor: 'assignee' },
      supersede: { from: ['requested', 'processing'], to: 'superseded', actor: 'system' },
    });
  });

  it('treats requested/processing/accepted as open, the rest terminal', () => {
    expect(ALL_STATUSES.filter(isOpen)).toEqual(['requested', 'processing', 'accepted']);
    expect([...OPEN_STATUSES]).toEqual(['requested', 'processing', 'accepted']);
  });

  it('lands accept/assignVendor on open statuses and every other action on a terminal one', () => {
    expect(isOpen(MATERIAL_REQUEST_TRANSITIONS.accept.to)).toBe(true); // processing
    expect(isOpen(MATERIAL_REQUEST_TRANSITIONS.assignVendor.to)).toBe(true); // accepted
    for (const action of ['decline', 'cancel', 'close', 'return', 'supersede'] as const) {
      expect(isOpen(MATERIAL_REQUEST_TRANSITIONS[action].to)).toBe(false);
    }
  });

  it('supersedes only the vendor-pending statuses (accepted carries over)', () => {
    expect([...SUPERSEDABLE_STATUSES]).toEqual(['requested', 'processing']);
    expect(SUPERSEDABLE_STATUSES).not.toContain('accepted');
  });

  it('cannot skip processing — assignVendor only leaves processing, accept only leaves requested', () => {
    expect(MATERIAL_REQUEST_TRANSITIONS.accept.from).toEqual(['requested']);
    expect(MATERIAL_REQUEST_TRANSITIONS.assignVendor.from).toEqual(['processing']);
  });

  it('allows decline from either open vendor-pending state but close/return only from accepted', () => {
    expect(MATERIAL_REQUEST_TRANSITIONS.decline.from).toEqual(['requested', 'processing']);
    expect(MATERIAL_REQUEST_TRANSITIONS.close.from).toEqual(['accepted']);
    expect(MATERIAL_REQUEST_TRANSITIONS.return.from).toEqual(['accepted']);
  });
});
