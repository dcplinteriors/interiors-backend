/**
 * Seeds a sample material request so the Admin "Requests" screen has something to review
 * (the supervisor-facing User app that normally submits these isn't built yet).
 *
 * Submits as the given supervisor against a project they're assigned to (material-request
 * submission requires the supervisor to be assigned). Each item becomes its own row.
 *
 * Usage:
 *   tsx scripts/seedRequest.ts [supervisorEmail]   # defaults to supervisor@dcpl.test
 *
 * Requires Firebase credentials in the environment (see .env). Run the Admin app first to
 * create a project and assign it to this supervisor, otherwise this prints guidance.
 */
import { getAuth, getDb } from '../src/config/firebase';
import { createContainer } from '../src/container';

async function main(): Promise<void> {
  const email = process.argv[2] ?? 'supervisor@dcpl.test';

  const user = await getAuth().getUserByEmail(email); // throws if missing

  const snap = await getDb()
    .collection('projects')
    .where('supervisorId', '==', user.uid)
    .limit(1)
    .get();

  if (snap.empty) {
    console.error(
      `No project is assigned to ${email}.\n` +
        'In the Admin app: create a project, open it, and assign this supervisor — then re-run.',
    );
    process.exit(1);
  }

  const projectId = snap.docs[0].id;
  const container = createContainer();

  const created = await container.materialRequestService.submit({
    projectId,
    supervisorUid: user.uid,
    items: [
      { particular: 'Teak Plywood 19mm', make: 'Greenply', quantity: 12, unit: 'SHEET' },
      { particular: 'SS Butt Hinges 4"', make: 'Hettich', quantity: 40, unit: 'SET' },
      { particular: 'Laminate Sheet 1mm', make: 'Merino', quantity: 8, unit: 'SHEET' },
    ],
  });

  console.log(`Seeded ${created.length} request(s) on project ${projectId}:`);
  created.forEach((r) => console.log(`  ${r.jobNumber}  ${r.particular}  [${r.status}]`));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
