/** READ-ONLY dump of work orders + material requests to reconcile counts. No writes. */
import { getDb } from '../src/config/firebase';

async function main(): Promise<void> {
  const db = getDb();
  const [wos, reqs] = await Promise.all([
    db.collection('workOrders').get(),
    db.collection('materialRequests').get(),
  ]);

  const woById = new Map(
    wos.docs.map((d) => [d.id, d.data() as Record<string, unknown>]),
  );

  console.log(`\n=== workOrders (${wos.size}) ===`);
  for (const d of wos.docs) {
    const w = d.data();
    console.log(
      `  ${d.id}  #${w.number}  "${w.name}"  project=${w.project}  status=${w.status}  sup=${w.supervisorId ?? '—'}`,
    );
  }

  console.log(`\n=== materialRequests (${reqs.size}) ===`);
  const byWo = new Map<string, number>();
  const rows = reqs.docs
    .map((d) => {
      const r = d.data();
      byWo.set(r.workOrder as string, (byWo.get(r.workOrder as string) ?? 0) + 1);
      return {
        id: d.id,
        itemNumber: r.itemNumber as string,
        workOrder: r.workOrder as string,
        woNumber: (woById.get(r.workOrder as string)?.number as string) ?? '??(WO not found)',
        project: r.project as string,
        status: r.status as string,
        batchId: r.batchId as string,
        createdAt: r.createdAt as string,
      };
    })
    .sort((a, b) => a.itemNumber.localeCompare(b.itemNumber));

  for (const r of rows) {
    // itemNumber encodes the WO number it was created under; flag if that prefix
    // doesn't match the WO its `workOrder` field now points to (reassignment / drift).
    const prefix = r.itemNumber.split('/').slice(0, 2).join('/');
    const mismatch = prefix !== r.woNumber ? `  ⚠ itemNumber prefix ${prefix} ≠ workOrder #${r.woNumber}` : '';
    console.log(
      `  ${r.itemNumber}  id=${r.id}  status=${r.status}  batch=${r.batchId.slice(0, 8)}  wo=${r.workOrder}(#${r.woNumber})${mismatch}`,
    );
  }

  console.log('\n=== count by workOrder field ===');
  for (const [wo, n] of byWo)
    console.log(`  ${wo} (#${woById.get(wo)?.number ?? '??'}): ${n}`);
  console.log();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
