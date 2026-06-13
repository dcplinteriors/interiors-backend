/**
 * Generates a direct "set / reset password" link for a supervisor via the Admin SDK —
 * bypasses email delivery entirely. Hand the printed URL to the person to set their password.
 *
 * Usage:
 *   tsx scripts/resetLink.ts <email>     # link for one user
 *   tsx scripts/resetLink.ts             # list all supervisors (then re-run with an email)
 *
 * Requires Firebase credentials in the environment (see .env).
 */
import { getAuth, getDb } from '../src/config/firebase';

async function listSupervisors(): Promise<void> {
  const snap = await getDb().collection('users').where('role', '==', 'supervisor').get();
  if (snap.empty) {
    console.log('No supervisors found.');
    return;
  }
  console.log('Supervisors (re-run with one of these emails):');
  snap.forEach((doc) => {
    const d = doc.data();
    console.log(`  - ${d.email}   (${d.name ?? 'no name'})`);
  });
}

async function main(): Promise<void> {
  const email = process.argv[2];
  if (!email) {
    await listSupervisors();
    return;
  }

  const auth = getAuth();
  const user = await auth.getUserByEmail(email); // throws auth/user-not-found if missing
  const link = await auth.generatePasswordResetLink(email);

  console.log(`User: ${email} (uid: ${user.uid})`);
  console.log('Set-password link:');
  console.log(link);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
