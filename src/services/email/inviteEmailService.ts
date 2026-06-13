import { env } from '../../config/env';
import { logger } from '../../utils/logger';
import { AppError } from '../../utils/AppError';

/**
 * Sends the supervisor a "set your password" email. Abstracted so the supervisor
 * service can be tested without sending real email.
 */
export interface InviteEmailService {
  sendSetPasswordEmail(email: string): Promise<void>;
}

/**
 * Triggers Firebase Auth's built-in password-reset email (Option A — no third-party
 * provider) via the Identity Toolkit `accounts:sendOobCode` endpoint. If the Web API key
 * isn't configured (e.g. local dev), it logs and skips rather than failing the request.
 */
export class FirebaseInviteEmailService implements InviteEmailService {
  async sendSetPasswordEmail(email: string): Promise<void> {
    const apiKey = env.FIREBASE_WEB_API_KEY;
    if (!apiKey) {
      logger.warn({ email }, 'FIREBASE_WEB_API_KEY not set — skipping set-password email');
      return;
    }

    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestType: 'PASSWORD_RESET', email }),
      },
    );

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      logger.error({ email, status: res.status, detail }, 'Failed to send set-password email');
      throw new AppError(502, 'Failed to send set-password email');
    }
  }
}
