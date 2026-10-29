# User guide: roles and common daily tasks

This guide describes current interfaces at a practical level. Menu labels can vary by project and language; the server remains the authority for which farms and actions a user may access.

## 1. Who can do what?

| Role | Farm access | Main responsibilities |
|---|---|---|
| Owner | All farms in that app | Add, rename, archive and delete farms; create managers and workers; assign farm access; full control over farm records. |
| Manager | Only assigned farms | Manage work within assigned farms and create workers in those farms. Managers cannot create other managers or change the farm list. |
| Worker | Only assigned farms | Enter permitted daily records in assigned farms. Farm management, user management and financial actions may be restricted by the specific screen. |

Agri, Dairy and Flock have separate users, farms and databases. Being an owner in one app does not combine its data with another app. Change the selected farm before entering records, and verify the farm name/date on the screen. If a form or action is missing, ask the Owner to verify the assigned farm and role rather than using another person's login or bypassing a restriction.

## 2. Record daily milk (Dairy Farm)

1. Sign in to Dairy Farm and select the correct farm.
2. Open Milk, then choose Daily Entry.
3. Select the date. Enter Morning (L) and Evening (L) quantities for each cow with a record. Enter calf milk where applicable.
4. Use the row save action for one cow, or Save All to submit filled rows. Wait for the success message and confirm the displayed totals/date.
5. For earlier records, use History; edit only when the screen gives you permission.

The milk entry form uses liters and supports date-based records. Avoid creating duplicate records for the same cow/date; edit the existing record when correcting it. Review any error message instead of assuming every row saved.

## 3. Record eggs (Flock Farm)

For production tied to a poultry batch:

1. Select the correct Flock farm and open Batches.
2. Open the relevant batch and choose Log Eggs.
3. Enter the date and total eggs collected. Fill the direct/cash sold, home-use and broken/wasted counts that apply.
4. Save the egg log and review the batch's egg history/summary.

Sold, home-use and broken/wasted allocations must not exceed the total collected. Customer sales are tracked separately, and the app also checks that combined allocations do not exceed collection. If warned that a day's eggs are over-allocated, correct the collection or sale/use values before retrying.

For Home Birds or farm-wide records, use the appropriate Finance section and its Eggs entry rather than a batch log. Do not enter the same egg production in both the batch and farm-wide forms.

## 4. Record expenses

Pick the expense route matching what the cost belongs to. Avoid entering one receipt in two places, as that can double-count costs in summaries.

### Dairy Farm

1. Open Finance and choose All expenses (or the relevant category).
2. Choose Add New Expense.
3. Enter the date, type and amount. For feed, optionally enter kilograms so the stock card can use the quantity.
4. Add a supplier, cow, note or receipt photo where appropriate, then choose Add Expense.
5. Confirm the success notification and check the date/type/amount in the list.

### Flock Farm

- For a cost belonging to one poultry batch, open Batches, open the batch, and use Log Expense. Enter date, category, detail and amount, add notes if needed, and save.
- For a farm-wide/Home Birds operating cost, open Finance and select Expenses, then use the add action on that screen.

Keep batch expenses and farm-wide expenses in the correct place. Do not duplicate a batch cost in the general ledger.

### Agri Farm

1. Open Finance, then use Log Entry.
2. Choose the correct entry type (Expense for a cost), date, amount, category/description, and any farm/field/crop association the form requests.
3. Save, then verify the record appears under the intended selected farm and date.

The current Agri interface renders Finance for admin-role users; Workers may not see the Finance section. If a worker is expected to record expenses but cannot access this screen, ask the Owner to resolve the role/access policy rather than bypassing the UI.

## 5. Safe daily-entry habits

- Confirm the selected farm and date before saving.
- Enter quantities and currency amounts in the fields' displayed units.
- Keep one source of truth for a record: batch-specific or farm-wide, not both.
- Read error notifications, especially validation warnings, before retrying.
- Use edit/update for corrections when a record already exists.
- Deleting records may be restricted or irreversible; use the app's confirmation and ask the Owner if unsure.

For the complete role boundary, see FARMS_AND_ROLES.md. For setup and test accounts, see DEVELOPER_START.md and LOCAL-ROLE-TEST-ACCOUNTS.md.
