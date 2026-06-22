import { MaterialRequestStatus } from '../../models/materialRequest';

/** Who a transition requires. Admin actions are additionally gated at the route by role;
 * `owner`/`assignee` are ownership checks the service applies (they need the item's data). */
export type MaterialRequestActor = 'admin' | 'owner' | 'assignee' | 'system';

export type MaterialRequestAction =
  | 'accept'
  | 'assignVendor'
  | 'decline'
  | 'cancel'
  | 'close'
  | 'return'
  | 'supersede';

export interface MaterialRequestTransition {
  from: MaterialRequestStatus[];
  to: MaterialRequestStatus;
  actor: MaterialRequestActor;
}

/**
 * The single source of transition truth for a material-request item (ADR-0006). Every state
 * change funnels through `MaterialRequestService.transition`, which consults this table — so
 * adding a status is a one-row edit, not scattered conditionals.
 *
 *   requested ─accept→ processing ─assignVendor→ accepted ─┬─ close ──→ closed     (assignee)
 *      │ (admin)         │ (admin)        (admin)          └─ return → returned    (assignee)
 *      ├─ cancel → cancelled (owner)
 *      └─ requested|processing ─decline→ declined (admin) · ─supersede→ superseded (system)
 */
export const MATERIAL_REQUEST_TRANSITIONS: Record<
  MaterialRequestAction,
  MaterialRequestTransition
> = {
  accept: { from: ['requested'], to: 'processing', actor: 'admin' },
  assignVendor: { from: ['processing'], to: 'accepted', actor: 'admin' },
  decline: { from: ['requested', 'processing'], to: 'declined', actor: 'admin' },
  cancel: { from: ['requested'], to: 'cancelled', actor: 'owner' },
  close: { from: ['accepted'], to: 'closed', actor: 'assignee' },
  return: { from: ['accepted'], to: 'returned', actor: 'assignee' },
  supersede: { from: ['requested', 'processing'], to: 'superseded', actor: 'system' },
};

/** Items not yet finalized. A work order can complete only when it has none of these. */
export const OPEN_STATUSES: readonly MaterialRequestStatus[] = [
  'requested',
  'processing',
  'accepted',
];

export const isOpen = (status: MaterialRequestStatus): boolean => OPEN_STATUSES.includes(status);

/** The statuses flipped to `superseded` on work-order reassignment (the vendor-pending ones).
 * `accepted` items carry over to the new supervisor instead. */
export const SUPERSEDABLE_STATUSES: readonly MaterialRequestStatus[] =
  MATERIAL_REQUEST_TRANSITIONS.supersede.from;
