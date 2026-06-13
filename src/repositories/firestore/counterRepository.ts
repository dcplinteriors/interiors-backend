import { getDb } from '../../config/firebase';
import { CounterRepository } from '../counterRepository';

const COLLECTION = 'counters';

export class FirestoreCounterRepository implements CounterRepository {
  next(sequence: string, periodKey: string): Promise<number> {
    return this.reserve(sequence, periodKey, 1);
  }

  async reserve(sequence: string, periodKey: string, count: number): Promise<number> {
    const db = getDb();
    const ref = db.collection(COLLECTION).doc(`${sequence}_${periodKey}`);

    return db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const current = snap.exists ? ((snap.data()?.value as number) ?? 0) : 0;
      tx.set(ref, { value: current + count }, { merge: true });
      return current + 1; // first value of the reserved block
    });
  }
}
