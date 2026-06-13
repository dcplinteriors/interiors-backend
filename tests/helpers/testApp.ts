import { createApp } from '../../src/app';
import { ContainerOverrides, createContainer } from '../../src/container';
import { TokenVerifier } from '../../src/services/auth/tokenVerifier';
import { Role } from '../../src/types/auth';

/** Fixed "now" used across tests — June 2025 → FY 25-26, month 06. */
export const FIXED_NOW = new Date('2025-06-15T10:00:00.000Z');
export const fixedClock = () => FIXED_NOW;

export function verifierFor(uid: string, role: Role, email?: string): TokenVerifier {
  return { verify: async () => ({ uid, email, role }) };
}

export const adminVerifier = verifierFor('admin1', 'admin', 'admin@dcpl.test');
export const supervisorVerifier = (uid = 'sup1') => verifierFor(uid, 'supervisor', `${uid}@dcpl.test`);

export function buildApp(overrides: ContainerOverrides = {}) {
  return createApp(createContainer({ clock: fixedClock, ...overrides }));
}

/** Authorization header helper — the token value is irrelevant (the verifier is faked). */
export const bearer = (): [string, string] => ['Authorization', 'Bearer test-token'];
