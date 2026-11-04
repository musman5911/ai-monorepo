# Local role and farm-isolation test accounts

These are fake, test-only accounts. They are created by the local in-memory demo seed and by the disposable MongoDB seed helper. They must never be reused for a public deployment or a real user account.

Set `MUF_DEMO_PROFILE=basic` for the original two-farm fixture, or `MUF_DEMO_PROFILE=rich` for the five-farm fixture. The rich profile is the default once the seed work is enabled. Data in memory mode is rebuilt on every backend restart.

## Test accounts

| Role | Username | Password | Farm assignment in rich profile |
|---|---|---|---|
| Owner (legacy `admin` role is normalized to owner) | `admin` | `admin123` | All farms |
| Worker | `worker` | `worker123` | Farm 1 |
| Manager | `manager` | `manager123` | Farms 2 and 3 |
| Worker | `worker2` | `worker2123` | Farms 2 and 3 |
| Manager | `manager2` | `manager2123` | Farm 3 |
| Manager | `manager3` | `manager3123` | Archived Farm 4 |
| Worker | `worker3` | `worker3123` | Farm 2 |
| Worker | `worker4` | `worker4123` | Farm 3 |
| Worker | `worker5` | `worker5123` | Archived Farm 4 |
| Worker | `worker6` | `worker6123` | Farm 2 |

In the basic profile, Farm 1 is `Farm 1` and Farm 2 is `Farm 2 - Access Test`. The same owner and worker credentials are used; `manager` and `worker2` are assigned to Farm 2. The additional rich-profile accounts do not exist in basic mode.

Farm names differ by app:

| Farm slot | Dairy | Agri | Flock |
|---|---|---|---|
| 1 | Hattar Dairy Unit | Hattar Crop Estate | Hattar Poultry Unit |
| 2 | Khanpur Milk Farm | Bhoi Gar Fields | Haripur Layer Farm |
| 3 | Taxila Cattle Unit | Taxila Orchard Fields | Taxila Broiler Unit |
| 4 (archived) | Archived Tarnol Unit | Archived Fateh Jang Fields | Archived Attock Flock |
| 5 (empty) | Empty Trial Unit | Empty Trial Fields | Empty Trial Flock |

The rich profile deliberately has data in Farms 1–4, including the archived Farm 4, and no records in Farm 5. Shop products are distributed across Farms 1–4.

## Verification order

1. Log in as `admin` and confirm the five farms appear in rich mode. The archived farm should be marked archived; the empty trial farm should contain no records.
2. Check the worker account: Farm 1 is accessible and other farms are not.
3. Check `manager` and `worker2`: Farms 2 and 3 are assigned; Farm 1 and Farm 4 are not.
4. Check `manager2`, `manager3`, and the remaining workers against the table above.
5. Add distinct records in two farms and confirm switching farms does not leak records across them.
6. Return to the owner and verify owner-only actions, archive/restore, backup and shop publication behavior.
7. Use a disposable database for destructive deletion and restore tests. Do not use a live or production database.

## Deterministic seed dates and profile

- `MUF_SEED_TODAY=YYYY-MM-DD` anchors generated dates. Invalid calendar dates are rejected.
- `MUF_DEMO_PROFILE=basic` selects the original two-farm demo.
- `MUF_DEMO_PROFILE=rich` selects the five-farm role-isolation demo.
- Generated records use stable `seed-` identifiers where supported by their models. The pseudo-random sequence is deterministic per app.

The passwords above are deliberately simple because these accounts are for local QA only. Do not expose a memory-mode backend to the public internet.
