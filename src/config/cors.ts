import { CorsOptions } from 'cors';
import { env } from './env';

/**
 * CORS for the Flutter web clients. By default the request origin is reflected (works for
 * any origin — needed in dev); set `CORS_ORIGINS` (comma-separated) to lock it down in prod.
 *
 * Auth is via the `Authorization` header (no cookies), so `credentials` stays off; we
 * explicitly allow that header so browser preflight passes.
 */
export function corsOptions(): CorsOptions {
  const allowed = env.CORS_ORIGINS?.split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  return {
    origin: allowed && allowed.length > 0 ? allowed : true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  };
}
