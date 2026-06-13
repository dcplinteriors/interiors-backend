/**
 * Seeds (or updates) an admin account — admins are provisioned manually, not via the API.
 *
 * Usage:
 *   tsx scripts/seedAdmin.ts <email> <name> <password>
 *
 * Requires Firebase credentials in the environment (see .env / .env.example). Creates the
 * Auth user if absent, sets the `role: admin` custom claim, and writes the `users` record.
 */
import { getAuth, getDb } from '../src/config/firebase';

async function main(): Promise<void> {
  const [email, name, password] = process.argv.slice(2);
  if (!email || !name || !password) {
    console.error('Usage: tsx scripts/seedAdmin.ts <email> <name> <password>');
    process.exit(1);
  }

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

  await auth.setCustomUserClaims(uid, { role: 'admin' });

  await getDb()
    .collection('users')
    .doc(uid)
    .set(
      {
        uid,
        role: 'admin',
        name,
        email,
        isActive: true,
        createdAt: new Date().toISOString(),
      },
      { merge: true },
    );

  console.log(`Admin ready: ${email} (uid: ${uid})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
