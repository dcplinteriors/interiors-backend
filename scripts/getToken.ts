/**
 * Mints a Firebase ID token by signing in with email/password (Identity Toolkit REST).
 * Handy for hitting protected API endpoints from curl during development.
 *
 * Usage: tsx scripts/getToken.ts <email> <password>
 * Tip:   TOKEN=$(npm run -s get-token -- you@dcpl.test secret123)
 */
import { env } from '../src/config/env';

async function main(): Promise<void> {
  const [email, password] = process.argv.slice(2);
  if (!email || !password) {
    console.error('Usage: tsx scripts/getToken.ts <email> <password>');
    process.exit(1);
  }
  if (!env.FIREBASE_WEB_API_KEY) {
    console.error('FIREBASE_WEB_API_KEY is not set in .env');
    process.exit(1);
  }

  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${env.FIREBASE_WEB_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  );

  const data = (await res.json()) as { idToken?: string; error?: { message?: string } };
  if (!res.ok || !data.idToken) {
    console.error('Sign-in failed:', data.error?.message ?? res.status);
    process.exit(1);
  }

  // Print only the token so it can be captured into a shell variable.
  console.log(data.idToken);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
