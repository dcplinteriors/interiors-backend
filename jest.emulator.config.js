/**
 * Emulator-backed tests for the Firestore repositories. Run via `npm run test:emulator`,
 * which starts the Firestore emulator (`firebase emulators:exec`) and sets
 * FIRESTORE_EMULATOR_HOST for this process. Serial (maxWorkers: 1) — tests share one
 * emulator and clear data between cases.
 */
/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests/emulator'],
  testMatch: ['**/*.test.ts'],
  clearMocks: true,
  maxWorkers: 1,
};
