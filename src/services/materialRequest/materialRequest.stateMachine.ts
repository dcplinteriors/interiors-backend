import { MaterialRequestStatus } from '../../models/materialRequest';

/** Who a transition requires. Admin actions are additionally gated at the route by role;
 * `owner`/`assignee` are ownership checks the service applies (they need the item's data). */
export type MaterialRequestActor = 'admin' | 'owner' | 'assignee';

export type MaterialRequestAction =
  | 'accept'
  | 'assignVendor'
  | 'decline'
  | 'cancel'
  | 'close';

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
 *   requested ─accept→ processing ─assignVendor→ accepted ─close→ closed   (assignee)
 *      │ (admin)         │ (admin)        (admin)
 *      ├─ cancel → cancelled (owner)
 *      └─ requested|processing ─decline→ declined (admin)
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
};

/** Items not yet finalized. A work order can complete only when it has none of these. */
export const OPEN_STATUSES: readonly MaterialRequestStatus[] = [
  'requested',
  'processing',
  'accepted',
];

export const isOpen = (status: MaterialRequestStatus): boolean => OPEN_STATUSES.includes(status);
