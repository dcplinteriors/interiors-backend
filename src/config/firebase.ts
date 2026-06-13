import admin from 'firebase-admin';
import { env } from './env';

let app: admin.app.App | undefined;

/**
 * Lazily initialises the Firebase Admin app. Called by repositories only —
 * the rest of the app (and unit tests) never touch Firebase, so no credentials
 * are required to boot or to run tests that don't hit the data layer.
 */
export function getFirebaseApp(): admin.app.App {
  if (!app) {
    if (process.env.FIRESTORE_EMULATOR_HOST) {
      // Emulator mode (tests / local) — no real credentials required.
      app = admin.initializeApp({ projectId: env.FIREBASE_PROJECT_ID ?? 'demo-dcpl' });
    } else {
      const credential = env.FIREBASE_SERVICE_ACCOUNT
        ? admin.credential.cert(JSON.parse(env.FIREBASE_SERVICE_ACCOUNT))
        : admin.credential.applicationDefault();
      app = admin.initializeApp({ credential, projectId: env.FIREBASE_PROJECT_ID });
    }
    // Optional model fields (e.g. a supervisor's phone) can be `undefined`; without this,
    // Firestore `.set()` throws. Ignoring undefined keeps writes resilient.
    app.firestore().settings({ ignoreUndefinedProperties: true });
  }
  return app;
}

export function getDb(): admin.firestore.Firestore {
  return getFirebaseApp().firestore();
}

export function getAuth(): admin.auth.Auth {
  return getFirebaseApp().auth();
}

/** The Cloud Storage bucket used for attachments. */
export function getBucket(): ReturnType<admin.storage.Storage['bucket']> {
  const name = env.FIREBASE_STORAGE_BUCKET ?? `${env.FIREBASE_PROJECT_ID}.firebasestorage.app`;
  return getFirebaseApp().storage().bucket(name);
}
