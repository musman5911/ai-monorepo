import { describe, expect, it } from 'vitest';
import { resolveNewUserFarmIds } from '../flock_farm/backend/new-user-farm-assignment.mjs';

const activeFarms = ['farm-a', 'farm-b', 'farm-c'];

describe('Flock new-user farm assignment', () => {
  it('lets an owner assign multiple active farms when creating a worker or manager', () => {
    expect(resolveNewUserFarmIds({
      requesterRole: 'owner', targetRole: 'worker', requestedFarmIds: ['farm-a', 'farm-b', 'farm-a'],
      selectedFarmId: 'farm-c', activeFarmIds: activeFarms,
    })).toEqual({ farmIds: ['farm-a', 'farm-b'] });
  });
  it('defaults owner-created workers to the selected farm when no assignments are supplied', () => {
    expect(resolveNewUserFarmIds({
      requesterRole: 'owner', targetRole: 'worker', selectedFarmId: 'farm-b', activeFarmIds: activeFarms,
    })).toEqual({ farmIds: ['farm-b'] });
  });
  it('rejects unknown or archived farm IDs and empty assignments', () => {
    expect(resolveNewUserFarmIds({
      requesterRole: 'owner', targetRole: 'manager', requestedFarmIds: ['farm-a', 'archived-farm'],
      activeFarmIds: activeFarms,
    }).error).toMatch(/exist and be active/);
    expect(resolveNewUserFarmIds({
      requesterRole: 'owner', targetRole: 'worker', requestedFarmIds: [], activeFarmIds: activeFarms,
    }).error).toMatch(/Assign at least one/);
  });
  it('keeps managers limited to creating workers for the currently selected farm', () => {
    expect(resolveNewUserFarmIds({
      requesterRole: 'manager', targetRole: 'worker', requestedFarmIds: ['farm-a'],
      selectedFarmId: 'farm-b', activeFarmIds: activeFarms,
    }).error).toMatch(/currently selected farm/);
    expect(resolveNewUserFarmIds({
      requesterRole: 'manager', targetRole: 'worker', selectedFarmId: 'farm-b', activeFarmIds: activeFarms,
    })).toEqual({ farmIds: ['farm-b'] });
  });
  it('does not assign owner accounts to individual farms', () => {
    expect(resolveNewUserFarmIds({
      requesterRole: 'owner', targetRole: 'owner', activeFarmIds: activeFarms,
    })).toEqual({ farmIds: [] });
  });
});
