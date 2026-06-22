import { CorsOptions } from 'cors';
import { env } from './env';

/**
 * CORS for the Flutter web clients. By default the request origin is reflected (works for
 * any origin — needed in dev); set `CORS_ORIGINS` (comma-separated) to lock it down in prod.
 *
 * Local dev origins (`localhost`/`127.0.0.1`, any port) are ALWAYS allowed, even when a
 * prod allowlist is set — `flutter run -d chrome` picks a random web port each run, so an
 * exact-match allowlist can't cover it. This is safe because auth is via the `Authorization`
 * header (no cookies), so `credentials` stays off; we allow that header so preflight passes.
 */
const LOCALHOST = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

export function corsOptions(): CorsOptions {
  const allowed = env.CORS_ORIGINS?.split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  return {
    origin: (origin, cb) => {
      // Non-browser clients (mobile, curl) send no Origin header — always allow.
      if (!origin) return cb(null, true);
      // Local web dev — any port.
      if (LOCALHOST.test(origin)) return cb(null, true);
      // No allowlist configured → reflect any origin (dev default).
      if (!allowed || allowed.length === 0) return cb(null, true);
      // Allowlist configured → only permit listed origins.
      return cb(null, allowed.includes(origin));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  };
}
