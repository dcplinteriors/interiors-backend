/**
 * READ-ONLY audit of the `counters` collection.
 *
 * Dumps every counter doc, then cross-checks each against the entities in its
 * scope: the counter `value` must be >= the count of entities AND >= the max
 * number actually used (gaps are allowed, so >=, not ==). Also flags duplicate
 * numbers (a real uniqueness bug) and counters/entities that exist without their
 * counterpart. Performs NO writes.
 *
 *   npx tsx scripts/auditCounters.ts
 */
import { getDb } from '../src/config/firebase';

type Doc = FirebaseFirestore.QueryDocumentSnapshot;

const lastSeg = (s: string, sep: string): number =>
  Number.parseInt(s.split(sep).pop() ?? '', 10);

/** Per-scope check: value vs the entity numbers actually used. */
function checkScope(
  label: string,
  value: number,
  indices: number[],
): string[] {
  const problems: string[] = [];
  const count = indices.length;
  const max = indices.length ? Math.max(...indices) : 0;
  const dupes = indices.filter((n, i) => indices.indexOf(n) !== i);

  if (value < max) problems.push(`value ${value} < max used ${max} (CORRUPT)`);
  if (value < count) problems.push(`value ${value} < entity count ${count} (CORRUPT)`);
  if (dupes.length) problems.push(`duplicate numbers: ${[...new Set(dupes)].join(', ')}`);
  if (indices.some((n) => Number.isNaN(n) || n < 1))
    problems.push('unparseable / <1 index present');

  const gaps = value - count;
  const note = gaps > 0 ? `  (${gaps} gap${gaps === 1 ? '' : 's'} — burned on failed/abandoned creates)` : '';
  console.log(
    `  ${label}: value=${value} · used=${count} · maxIndex=${max}${note}` +
      (problems.length ? `  ❌ ${problems.join('; ')}` : '  ✅'),
  );
  return problems;
}

async function main(): Promise<void> {
  const db = getDb();
  const [counters, projects, workOrders, requests] = await Promise.all([
    db.collection('counters').get(),
    db.collection('projects').get(),
    db.collection('workOrders').get(),
    db.collection('materialRequests').get(),
  ]);

  console.log(`\n=== counters/ (${counters.size} docs) ===`);
  const raw = counters.docs
    .map((d: Doc) => ({ id: d.id, value: d.data().value as number }))
    .sort((a, b) => a.id.localeCompare(b.id));
  for (const c of raw) console.log(`  ${c.id} = ${c.value}`);

  const byId = new Map(raw.map((c) => [c.id, c.value]));
  const allProblems: string[] = [];
  const expectedCounterIds = new Set<string>();

  // --- project counters: project_<FY> ---
  console.log('\n=== project counters ===');
  const fyGroups = new Map<string, number[]>();
  for (const d of projects.docs) {
    const number = d.data().number as string; // FY_NNNN
    const fy = number.split('_')[0];
    fyGroups.set(fy, [...(fyGroups.get(fy) ?? []), lastSeg(number, '_')]);
  }
  for (const [fy, indices] of fyGroups) {
    const id = `project_${fy}`;
    expectedCounterIds.add(id);
    if (!byId.has(id)) {
      console.log(`  ${id}: ❌ MISSING counter but ${indices.length} project(s) exist`);
      allProblems.push(id);
      continue;
    }
    allProblems.push(...checkScope(id, byId.get(id)!, indices).map(() => id));
  }

  // --- work-order counters: workOrder_<projectId> ---
  console.log('\n=== work-order counters ===');
  const woGroups = new Map<string, number[]>();
  for (const d of workOrders.docs) {
    const pid = d.data().project as string;
    const number = d.data().number as string; // <projectNumber>/NNNN
    woGroups.set(pid, [...(woGroups.get(pid) ?? []), lastSeg(number, '/')]);
  }
  for (const [pid, indices] of woGroups) {
    const id = `workOrder_${pid}`;
    expectedCounterIds.add(id);
    if (!byId.has(id)) {
      console.log(`  ${id}: ❌ MISSING counter but ${indices.length} work order(s) exist`);
      allProblems.push(id);
      continue;
    }
    allProblems.push(...checkScope(id, byId.get(id)!, indices).map(() => id));
  }

  // --- item counters: item_<workOrderId> ---
  console.log('\n=== item counters ===');
  const itemGroups = new Map<string, number[]>();
  for (const d of requests.docs) {
    const woId = d.data().workOrder as string;
    const number = d.data().itemNumber as string; // <workOrderNumber>/NNNN
    itemGroups.set(woId, [...(itemGroups.get(woId) ?? []), lastSeg(number, '/')]);
  }
  for (const [woId, indices] of itemGroups) {
    const id = `item_${woId}`;
    expectedCounterIds.add(id);
    if (!byId.has(id)) {
      console.log(`  ${id}: ❌ MISSING counter but ${indices.length} item(s) exist`);
      allProblems.push(id);
      continue;
    }
    allProblems.push(...checkScope(id, byId.get(id)!, indices).map(() => id));
  }

  // --- orphan counters: a counter doc with no entities in its scope ---
  const orphans = raw.filter((c) => !expectedCounterIds.has(c.id));
  if (orphans.length) {
    console.log('\n=== orphan counters (no entities in scope) ===');
    for (const o of orphans)
      console.log(`  ${o.id} = ${o.value}  (value>0 but nothing created, or all deleted)`);
  }

  console.log(
    `\n=== RESULT: ${allProblems.length ? `❌ ${new Set(allProblems).size} counter(s) with problems` : '✅ all counters consistent (gaps, if any, are expected)'} ===\n`,
  );
  process.exit(allProblems.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
