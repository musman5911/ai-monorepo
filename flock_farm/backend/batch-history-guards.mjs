/** Return a conflict payload when linked operational history would be orphaned. */
export function linkedBatchHistoryConflict(counts) {
  const linkedIncubation = Number(counts?.linkedIncubation || 0);
  const linkedAttendance = Number(counts?.linkedAttendance || 0);
  if (linkedIncubation + linkedAttendance === 0) return null;
  return {
    error: 'Batch data cannot be replaced or wiped while incubation or labor attendance records are linked to batches. Unlink or export and reconcile those records first.',
    code: 'BATCH_HAS_LINKED_HISTORY',
    linkedIncubationRecords: linkedIncubation,
    linkedLaborRecords: linkedAttendance,
  };
}
