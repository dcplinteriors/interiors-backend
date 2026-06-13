/**
 * Seeds (or updates) a supervisor account directly — for local/dev testing.
 *
 * Usage:
 *   tsx scripts/seedSupervisor.ts <email> <name> <password> [phone]
 *
 * NOTE: real supervisors are provisioned by an admin through the API, which creates
 * them WITHOUT a password and emails an invite (mustChangePassword: true until they
 * set their own). This script shortcuts that for testing: it sets the password
 * directly and marks mustChangePassword: false so you can log straight in. Mirrors
 * scripts/seedAdmin.ts — creates the Auth user if absent, sets the `role: supervisor`
 * custom claim, and writes the `users` record.
 */
import { getAuth, getDb } from '../src/config/firebase';

async function main(): Promise<void> {
  const [rawEmail, name, password, phone] = process.argv.slice(2);
  if (!rawEmail || !name || !password) {
    console.error('Usage: tsx scripts/seedSupervisor.ts <email> <name> <password> [phone]');
    process.exit(1);
  }
  const email = rawEmail.trim().toLowerCase();

  const auth = getAuth();

  let uid: string;
  try {
    const existing = await auth.getUserByEmail(email);
    uid = existing.uid;
    await auth.updateUser(uid, { password, displayName: name });
  } catch (err) {
    // Only fall through to creation when the user genuinely doesn't exist; surface anything else.
    if ((err as { code?: string }).code !== 'auth/user-not-found') {
      throw err;
    }
    const created = await auth.createUser({ email, password, displayName: name });
    uid = created.uid;
  }

  await auth.setCustomUserClaims(uid, { role: 'supervisor' });

  await getDb()
    .collection('users')
    .doc(uid)
    .set(
      {
        uid,
        role: 'supervisor',
        name,
        email,
        ...(phone ? { phone } : {}),
        isActive: true,
        createdAt: new Date().toISOString(),
        mustChangePassword: false,
      },
      { merge: true },
    );

  console.log(`Supervisor ready: ${email} (uid: ${uid})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
