import pino from 'pino';
import { env } from '../config/env';

const isDevelopment = env.NODE_ENV === 'development';

export const logger = pino({
  level: env.NODE_ENV === 'test' ? 'silent' : (env.LOG_LEVEL ?? 'info'),
  // Readable, colorized single-line logs in development; structured JSON in production.
  transport: isDevelopment
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:HH:MM:ss',
          // Hide the structured request/response objects — the message line already
          // carries method, url, status, and timing. (Error stacks still print.)
          ignore: 'pid,hostname,req,res,responseTime',
        },
      }
    : undefined,
});
