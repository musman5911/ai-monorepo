/**
 * Shared Telegram farm-context helpers.
 *
 * Telegram webhooks and scheduled jobs do not have an HTTP user's selected
 * farm. Never let them fall through to the process-wide default farm when a
 * link/code already identifies its owning farm.
 */
export function mufTelegramFarmId(record) {
  const id = record && (record.farmId || record.farm_id);
  return id == null || String(id).trim() === '' ? '' : String(id);
}

export function mufTelegramFarmContext(farmId, userId = 'telegram') {
  const id = farmId == null ? '' : String(farmId).trim();
  if (!id) return null;
  return { mode: 'single', farmId: id, farmIds: [id], userId: String(userId || 'telegram') };
}

export function mufRunTelegramFarm(farmId, runWithFarmContext, callback, userId = 'telegram') {
  const context = mufTelegramFarmContext(farmId, userId);
  if (!context) return Promise.resolve(null);
  return runWithFarmContext(context, callback);
}
