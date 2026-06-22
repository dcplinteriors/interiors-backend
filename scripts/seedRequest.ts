/**
 * Seeds a sample material request so the Admin "Requests" screen has something to review
 * (the supervisor-facing User app that normally submits these isn't built yet).
 *
 * Self-contained: if the supervisor has no active work order, this creates a sample project +
 * work order and assigns it to them, then submits a few items (each becomes its own row).
 *
 * Usage:
 *   tsx scripts/seedRequest.ts [supervisorEmail]   # defaults to supervisor@dcpl.test
 *
 * Requires Firebase credentials in the environment (see .env) and the supervisor to exist
 * (seed one with `npm run seed:supervisor`).
 */
import { getAuth, getDb } from '../src/config/firebase';
import { createContainer } from '../src/container';

async function main(): Promise<void> {
  const email = process.argv[2] ?? 'supervisor@dcpl.test';
  const user = await getAuth().getUserByEmail(email); // throws if the supervisor is missing
  const container = createContainer();

  // Reuse an active work order already assigned to this supervisor, else create one. (Single-field
  // query so no composite index is needed; status is filtered in memory.)
  const assigned = (
    await getDb().collection('workOrders').where('supervisorId', '==', user.uid).get()
  ).docs.find((d) => d.data().status === 'active');

  let workOrderId: string;
  if (assigned) {
    workOrderId = assigned.id;
    console.log(`Using existing work order ${assigned.data().number} (${workOrderId}).`);
  } else {
    const today = new Date().toISOString().slice(0, 10);
    const project = await container.projectService.create({
      name: 'Sample Project',
      clientName: 'Acme Interiors',
      projectEngineer: 'Seed Engineer',
      workOrders: [{ name: 'Ground Floor Fit-out', date: today }],
      createdBy: 'seed-script',
    });
    const workOrder = project.workOrders[0];
    await container.workOrderService.assign(workOrder.id, user.uid);
    workOrderId = workOrder.id;
    console.log(
      `Created project ${project.number} + work order ${workOrder.number}, assigned to ${email}.`,
    );
  }

  const created = await container.materialRequestService.submit({
    workOrderId,
    supervisorUid: user.uid,
    items: [
      { particular: 'Teak Plywood 19mm', make: 'Greenply', size: '8x4 ft', quantity: 12, unit: 'SHEET' },
      { particular: 'SS Butt Hinges 4"', make: 'Hettich', size: '4 inch', quantity: 40, unit: 'SET' },
      { particular: 'Laminate Sheet 1mm', make: 'Merino', size: '8x4 ft', quantity: 8, unit: 'SHEET' },
    ],
  });

  console.log(`Seeded ${created.length} request(s) on work order ${workOrderId}:`);
  created.forEach((r) => console.log(`  ${r.itemNumber}  ${r.particular}  [${r.status}]`));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
