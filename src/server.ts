import { app } from './app';
import { env } from './config/env';
import { logger } from './utils/logger';
import { getDb } from './config/firebase';

const server = app.listen(env.PORT, () => {
  logger.info(`DCPL backend listening on port ${env.PORT} (${env.NODE_ENV})`);
});

// Warm the Firestore gRPC channel during startup (and on every new instance Cloud Run
// spins up) so the FIRST real request doesn't pay connection-setup latency. Fire-and-forget
// so it never blocks readiness; skip in the emulator/tests. A failure here is non-fatal —
// the next request will just initialise lazily as before.
if (env.NODE_ENV === 'production' && !process.env.FIRESTORE_EMULATOR_HOST) {
  getDb()
    .collection('_warmup')
    .limit(1)
    .get()
    .then(() => logger.info('Firestore connection warmed'))
    .catch((err) => logger.warn({ err }, 'Firestore warmup failed (non-fatal)'));
}

// Graceful shutdown — let in-flight requests finish before exit (important on Cloud Run/k8s).
let shuttingDown = false;
function shutdown(signal: string): void {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`Received ${signal}, shutting down`);
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
  // Don't hang forever if connections won't drain.
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Last-resort safety nets — log and exit so the orchestrator restarts a healthy instance
// instead of serving from a half-broken process.
process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'Unhandled promise rejection');
  shutdown('unhandledRejection');
});
process.on('uncaughtException', (err) => {
  logger.error({ err }, 'Uncaught exception');
  shutdown('uncaughtException');
});

export { server };
