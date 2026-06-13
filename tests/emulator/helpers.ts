const projectId = process.env.FIREBASE_PROJECT_ID ?? 'demo-dcpl';
const host = process.env.FIRESTORE_EMULATOR_HOST;

/** Wipes all emulator data — call in beforeEach so tests start clean. */
export async function clearFirestore(): Promise<void> {
  if (!host) {
    throw new Error('FIRESTORE_EMULATOR_HOST not set — run via `npm run test:emulator`.');
  }
  await fetch(
    `http://${host}/emulator/v1/projects/${projectId}/databases/(default)/documents`,
    { method: 'DELETE' },
  );
}
