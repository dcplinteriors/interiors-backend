import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import pinoHttp from 'pino-http';
import { Container, createContainer } from './container';
import { corsOptions } from './config/cors';
import { logger } from './utils/logger';
import { buildRoutes } from './routes';
import { notFound } from './middlewares/notFound';
import { errorHandler } from './middlewares/errorHandler';

/**
 * Builds the Express app from a container (no listener) — so tests can inject fakes
 * and `server.ts` can own the process lifecycle.
 *
 * Middleware order: security headers → CORS → response compression → request logging →
 * body parsing → routes → 404 → error handler.
 */
export function createApp(container: Container = createContainer()): Express {
  const app = express();

  app.use(helmet());
  app.use(cors(corsOptions()));
  // gzip JSON responses — Cloud Run doesn't compress for us. Big win for list
  // endpoints over mobile networks; negligible cost for the small ones.
  app.use(compression());
  app.use(
    pinoHttp({
      logger,
      // One readable line per request: "GET /api/projects 200 (12ms)".
      // Use originalUrl — Express rewrites req.url to the router-relative path.
      customSuccessMessage: (req, res, responseTime) =>
        `${req.method} ${(req as { originalUrl?: string }).originalUrl ?? req.url} ${res.statusCode} (${responseTime}ms)`,
      customErrorMessage: (req, res, err) =>
        `${req.method} ${(req as { originalUrl?: string }).originalUrl ?? req.url} ${res.statusCode} — ${err.message}`,
      // 5xx → error, 4xx → warn, else info.
      customLogLevel: (_req, res, err) => {
        if (err || res.statusCode >= 500) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
      },
      // Drop the verbose header dumps (and the bearer token) — keep just the essentials.
      serializers: {
        req: (req) => ({ method: req.method, url: req.url }),
        res: (res) => ({ statusCode: res.statusCode }),
      },
    }),
  );
  app.use(express.json({ limit: '1mb' }));

  app.use('/api', buildRoutes(container));

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

export const app = createApp();
