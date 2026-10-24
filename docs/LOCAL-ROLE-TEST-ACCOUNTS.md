# Local role and farm-isolation test accounts

Seeded only in local in-memory demo mode (MEMORY_MODE=1 and no Mongo URI). These accounts are not inserted into a production database. Data is rebuilt whenever a memory-mode backend restarts.

| Role | Username | Password | Farm access |
|---|---|---|---|
| Owner | admin | admin123 | All farms; can manage farms/users |
| Worker | worker | worker123 | Farm 1 |
| Manager | manager | manager123 | Farm 2 - Access Test |
| Worker | worker2 | worker2123 | Farm 2 - Access Test |

Existing sample records and the existing worker account are assigned to Farm 1 by the memory-mode migration. Manager and worker2 are assigned to Farm 2. The owner can inspect both farms.

## Verification order

1. Log in as admin and confirm both farms appear. Create a temporary third farm to test farm creation.
2. Add distinct test records to Farm 1 and Farm 2.
3. Log in as worker; verify Farm 1 is visible and Farm 2 is inaccessible. Confirm the worker cannot delete structural records.
4. Log in as manager; verify Farm 2 is accessible and Farm 1 is inaccessible. Verify manager actions are scoped to Farm 2.
5. Return to admin, select All farms, and confirm edits/deletes are disabled.
6. Export and restore a JSON backup while still in All farms mode. Restoring is owner-only and database-wide; ordinary farm writes remain blocked in All farms mode.
7. Repeat restore with a backup containing photos/media. Restore JSON requests have a 100 MB limit and oversized requests return an explicit error.

Use disposable local data for deletion and restore tests. Restarting a memory-mode backend rebuilds demo data.
