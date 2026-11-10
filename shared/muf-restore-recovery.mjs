/**
 * Run a destructive restore only after a complete recovery snapshot exists.
 * If applying the target fails, restore the snapshot before returning failure.
 */
export async function withRestoreRecovery({ createSnapshot, restore, rollback }) {
  if (typeof createSnapshot !== 'function' || typeof restore !== 'function' || typeof rollback !== 'function') {
    throw new TypeError('Restore recovery requires createSnapshot, restore and rollback functions.');
  }

  // Keep this before the restore try block: a failed snapshot must never
  // allow the destructive operation to start.
  let snapshot;
  try {
    snapshot = await createSnapshot();
  } catch (snapshotError) {
    const error = new Error(
      `Restore was not started because the recovery snapshot failed: ${snapshotError?.message || snapshotError}`,
    );
    error.code = 'RESTORE_SNAPSHOT_FAILED';
    error.cause = snapshotError;
    throw error;
  }

  try {
    return await restore();
  } catch (restoreError) {
    try {
      await rollback(snapshot);
    } catch (rollbackError) {
      const error = new Error(
        `Restore failed (${restoreError?.message || restoreError}); recovery also failed (${rollbackError?.message || rollbackError}). Database state requires manual recovery.`,
      );
      error.code = 'RESTORE_AND_ROLLBACK_FAILED';
      error.cause = restoreError;
      error.rollbackError = rollbackError;
      throw error;
    }

    const error = new Error(
      `Restore failed and the previous database state was restored: ${restoreError?.message || restoreError}`,
    );
    error.code = 'RESTORE_ROLLED_BACK';
    error.cause = restoreError;
    error.restoredPreviousState = true;
    throw error;
  }
}
