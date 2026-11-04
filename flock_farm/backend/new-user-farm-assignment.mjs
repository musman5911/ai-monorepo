export function resolveNewUserFarmIds({
  requesterRole,
  targetRole,
  requestedFarmIds,
  selectedFarmId,
  activeFarmIds = [],
}) {
  const selected = selectedFarmId ? String(selectedFarmId) : '';
  if (targetRole === 'owner') {
    if (Array.isArray(requestedFarmIds) && requestedFarmIds.length) return { error: 'Owner accounts are not assigned to individual farms.' };
    return { farmIds: [] };
  }
  if (!['worker', 'manager'].includes(targetRole)) return { error: 'Unsupported account role.' };
  if (requesterRole === 'manager') {
    if (targetRole !== 'worker') return { error: 'Managers may create workers only.' };
    if (!selected) return { error: 'Select one farm before creating a worker.' };
    if (requestedFarmIds !== undefined && requestedFarmIds !== null) {
      if (!Array.isArray(requestedFarmIds)) return { error: 'farmIds must be an array.' };
      const requested = [...new Set(requestedFarmIds.map((id) => String(id)))];
      if (requested.length !== 1 || requested[0] !== selected) {
        return { error: 'Managers may assign a new worker only to the currently selected farm.' };
      }
    }
    return { farmIds: [selected] };
  }
  if (requesterRole !== 'owner') return { error: 'Only owners may choose farm assignments.' };
  const requested = requestedFarmIds === undefined || requestedFarmIds === null
    ? (selected ? [selected] : [])
    : requestedFarmIds;
  if (!Array.isArray(requested)) return { error: 'farmIds must be an array.' };
  const farmIds = [...new Set(requested.map((id) => String(id).trim()).filter(Boolean))];
  if (!farmIds.length) return { error: 'Assign at least one active farm to this account.' };
  const active = new Set(activeFarmIds.map((id) => String(id)));
  if (farmIds.some((id) => !active.has(id))) return { error: 'Every assigned farm must exist and be active.' };
  return { farmIds };
}
