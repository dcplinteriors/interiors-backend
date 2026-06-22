import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(8080),
  // Firebase config is optional so the app/tests can boot without credentials.
  // Repositories that actually touch Firebase will fail loudly if it's missing.
  FIREBASE_PROJECT_ID: z.string().optional(),
  GOOGLE_APPLICATION_CREDENTIALS: z.string().optional(),
  FIREBASE_SERVICE_ACCOUNT: z.string().optional(),
  // Web API key — used to trigger Firebase's built-in set-password email (Identity Toolkit).
  FIREBASE_WEB_API_KEY: z.string().optional(),
  // Cloud Storage bucket for attachments. Defaults to `<projectId>.firebasestorage.app`.
  FIREBASE_STORAGE_BUCKET: z.string().optional(),
  // Comma-separated allowed CORS origins. Unset = allow all (needed for Flutter web in dev).
  CORS_ORIGINS: z.string().optional(),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).optional(),
}).superRefine((val, ctx) => {
  // Firebase config is optional in dev/test (emulator), but must be present in production —
  // fail loudly at startup instead of 500-ing on the first real request.
  if (val.NODE_ENV !== 'production') return;
  // On Cloud Run (K_SERVICE is set) the attached service account provides
  // Application Default Credentials automatically — no explicit creds needed.
  const onCloudRun = Boolean(process.env.K_SERVICE);
  if (!onCloudRun && !val.FIREBASE_SERVICE_ACCOUNT && !val.GOOGLE_APPLICATION_CREDENTIALS) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message:
        'Set FIREBASE_SERVICE_ACCOUNT or GOOGLE_APPLICATION_CREDENTIALS in production (or deploy on Cloud Run for ADC)',
      path: ['FIREBASE_SERVICE_ACCOUNT'],
    });
  }
  if (!val.FIREBASE_PROJECT_ID) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'FIREBASE_PROJECT_ID is required in production',
      path: ['FIREBASE_PROJECT_ID'],
    });
  }
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  throw new Error(`Invalid environment variables:\n${parsed.error.toString()}`);
}

export const env = parsed.data;
export type Env = typeof env;
