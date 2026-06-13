import { app } from './app';
import { env } from './config/env';
import { logger } from './utils/logger';

const server = app.listen(env.PORT, () => {
  logger.info(`DCPL backend listening on port ${env.PORT} (${env.NODE_ENV})`);
});

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
