/**
 * Validate incubation egg allocations against batch egg logs for the active farm.
 * Inputs must already be loaded through the farm-scoped model context.
 */
export function validateIncubationAllocations(records, batches, eggLogs) {
  if (!Array.isArray(records)) return 'Incubation data must be an array.';

  const linkedIds = new Set(
    records.map((record) => String(record?.sourceBatchId || '').trim()).filter(Boolean),
  );
  if (linkedIds.size === 0) return null;

  const batchById = new Map(batches.map((batch) => [String(batch.batch_id), batch]));
  for (const batchId of linkedIds) {
    if (!batchById.has(batchId)) {
      return `Source batch "${batchId}" was not found in the selected farm.`;
    }
  }

  const availableByBatch = new Map();
  for (const batchId of linkedIds) availableByBatch.set(batchId, 0);
  for (const log of eggLogs) {
    const batchId = String(log.batch_id);
    if (!availableByBatch.has(batchId)) continue;
    const net = Number(log.collected || 0)
      - Number(log.sold || 0)
      - Number(log.home_use || 0)
      - Number(log.broken_wasted || 0);
    availableByBatch.set(batchId, availableByBatch.get(batchId) + net);
  }

  const allocatedByBatch = new Map();
  for (const record of records) {
    const batchId = String(record?.sourceBatchId || '').trim();
    if (!batchId) continue;
    const eggsSet = Number(record.eggsSet);
    if (!Number.isInteger(eggsSet) || eggsSet <= 0) {
      return `Incubation record ${record.id ?? '(new)'} must have a positive whole-number eggsSet count when linked to a batch.`;
    }
    allocatedByBatch.set(batchId, (allocatedByBatch.get(batchId) || 0) + eggsSet);
  }

  for (const batchId of linkedIds) {
    const available = availableByBatch.get(batchId) || 0;
    const allocated = allocatedByBatch.get(batchId) || 0;
    if (allocated > available) {
      return `Batch "${batchId}" has ${available} available eggs after sales, home use and waste, but incubation records allocate ${allocated}.`;
    }
  }
  return null;
}
