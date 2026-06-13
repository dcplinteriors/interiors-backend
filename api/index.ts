import type { IncomingMessage, ServerResponse } from 'node:http';

import { app } from '../src/app';

/**
 * Vercel serverless entrypoint.
 *
 * Hands the raw request/response straight to the Express app (which is itself a
 * Node request listener). `src/server.ts` — the long-running `app.listen()`
 * host used for local dev / Cloud Run — is deliberately NOT imported here, so
 * nothing tries to bind a port in the serverless runtime.
 *
 * `vercel.json` rewrites every path to this function; Express keeps its own
 * `/api/*` routing.
 */
export default function handler(req: IncomingMessage, res: ServerResponse): void {
  app(req, res);
}
