/** Validate optional batch links on daily labor attendance within the active farm. */
export function validateLaborBatchAssignments(records, batches) {
  if (!Array.isArray(records)) return 'Labor attendance data must be an array.';
  const batchIds = new Set(batches.map((batch) => String(batch.batch_id)));
  for (const row of records) {
    const batchId = String(row?.batchId || '').trim();
    if (batchId && !batchIds.has(batchId)) {
      return `Batch "${batchId}" was not found in the selected farm.`;
    }
  }
  return null;
}
