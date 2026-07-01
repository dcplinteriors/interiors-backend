import { randomInt } from 'crypto';

/**
 * Readable charset for temp passwords — mixes letters and digits but excludes glyphs that are
 * easy to misread when an admin reads the password aloud to a supervisor (`0 O o 1 l I`).
 */
const CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
const TEMP_PASSWORD_LENGTH = 10;

/**
 * Generates a temporary password from {@link CHARSET}. The default length comfortably clears
 * Firebase's 6-character minimum; the user must change it on first sign-in (`mustChangePassword`).
 */
export function generateTempPassword(length = TEMP_PASSWORD_LENGTH): string {
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += CHARSET[randomInt(CHARSET.length)];
  }
  return out;
}
