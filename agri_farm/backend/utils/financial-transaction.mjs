let memoryTransactionQueue = Promise.resolve();

function cloneMemoryValue(value) {
  if (value === null || typeof value !== 'object') return value;
  if (value instanceof Date) return new Date(value.getTime());
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(value)) return Buffer.from(value);
  if (value instanceof ArrayBuffer) return value.slice(0);
  if (ArrayBuffer.isView(value)) return new value.constructor(value);
  if (Array.isArray(value)) return value.map(cloneMemoryValue);
  if (value instanceof Map) {
    return new Map([...value.entries()].map(([key, item]) => [cloneMemoryValue(key), cloneMemoryValue(item)]));
  }
  if (value instanceof Set) return new Set([...value].map(cloneMemoryValue));

  // Preserve memory-model prototypes (Dairy documents expose save/deleteOne
  // through their prototype). structuredClone would flatten these into plain
  // objects, breaking subsequent operations after a rollback.
  const copy = Object.create(Object.getPrototypeOf(value));
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor && Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
      descriptor.value = cloneMemoryValue(descriptor.value);
    }
    Object.defineProperty(copy, key, descriptor);
  }
  return copy;
}

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
      if (Array.isArray(model?._store)) snapshots.set(model, cloneMemoryValue(model._store));
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
