let memoryTransactionQueue = Promise.resolve();

/**
 * Run financial writes as one unit. Real MongoDB deployments use a session
 * transaction; the disposable memory adapter uses a serialized, rollbackable
 * snapshot so tests and local demos keep the same safety contract.
 */
export async function runFinancialTransaction({ mongoose, memoryMode = false, models = [], work }) {
  if (typeof work !== 'function') throw new TypeError('A financial transaction callback is required.');

  if (memoryMode) {
    const previous = memoryTransactionQueue;
    let release;
    memoryTransactionQueue = new Promise((resolve) => { release = resolve; });
    await previous;

    const snapshots = new Map();
    for (const model of new Set(models)) {
      if (Array.isArray(model?._store)) snapshots.set(model, structuredClone(model._store));
    }

    try {
      return await work(null);
    } catch (error) {
      for (const [model, snapshot] of snapshots) {
        model._store.splice(0, model._store.length, ...snapshot);
      }
      throw error;
    } finally {
      release();
    }
  }

  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
}
