/**
 * Phone normalization for supervisor phone+password auth. Must match the Dart client EXACTLY:
 * the admin enters a 10-digit number, both sides derive the same canonical form and synthetic
 * email so the Firebase account they create and the one the supervisor signs in with agree.
 */

/** Domain for the synthetic emails that back phone+password auth (never a real mailbox). */
export const SYNTHETIC_EMAIL_DOMAIN = 'phone.dcpl-interiors.app';

/**
 * Canonical 12-digit `91`-prefixed form, or `null` if the input isn't a valid Indian mobile:
 * strip all non-digits; accept exactly 10 digits (prepend `91`) or 12 digits already starting `91`.
 */
export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return digits;
  return null;
}

/** The synthetic email for a phone, or `null` if the phone is invalid. */
export function syntheticEmail(raw: string): string | null {
  const normalized = normalizePhone(raw);
  return normalized ? `${normalized}@${SYNTHETIC_EMAIL_DOMAIN}` : null;
}
