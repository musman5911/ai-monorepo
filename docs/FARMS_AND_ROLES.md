# Farms, roles and shared systems

The rulebook for the scale-up project. It records the decisions the owner approved on 2026-10-22. `ROADMAP.md` says when each part is built; `PROGRESS.md` says what is done. Nothing here is built yet unless `PROGRESS.md` says so.

## 1. Shape of the system

```
                  MU FARMS (parent, later)
        Super Admin tab (private)  +  public shop (Phase 16)
              |                |                |
            AGRI             DAIRY            FLOCK
         own farms         own farms        own farms
         own users         own users        own users
         own database      own database     own database
```

- Agri, Dairy and Flock stay three separate apps. Each has its own farms, users, database and deployment.
- Dairy farms are only dairy farms, poultry farms are only in Flock, and crop land is only in Agri. Nothing is shared between projects except the read-only summary used by the Super Admin tab.
- Inside one project the user picks a farm and every tab shows that farm's data. "All farms" shows the total.

## 2. Roles

Exactly three roles. Do not add others.

| | Owner (super admin) | Manager | Worker |
|---|---|---|---|
| Sees farms | All | Only assigned | Only assigned |
| Add, rename, archive, delete farms | Yes | No | No |
| Create managers | Yes | No | No |
| Create workers | Yes | In own farms | No |
| Assign users to farms | Yes | Workers, in own farms | No |
| Super Admin tab | Yes | No | No |
| Full control inside a farm | Yes | Yes | No |
| Data entry | Yes | Yes | Yes |

- A manager is not an admin and cannot open the Super Admin tab.
- A worker only enters data (milk, eggs, feed, expenses and similar) in assigned farms.
- Every user has a list of assigned farms. Owners implicitly have all farms.
- Today's apps have only `admin` and `worker`. In the Phase 1 migration every existing `admin` becomes `owner`, and existing workers are assigned to "Farm 1".
- The API also returns the old `role` value (`admin` for owners and managers) next to the real `farmRole`. Phase 14 reviews every remaining use of the old value.

## 3. Farm rules

- A farm has a name and a location note. Names can be changed at any time.
- Only the owner adds, renames, archives or deletes farms.
- **Archive:** hides the farm and keeps all its data. It can be restored.
- **Delete an empty farm:** allowed directly.
- **Delete a farm that has data:** the owner must type the farm name, and the app exports a backup first. The owner may instead move the data to another farm, then delete.
- The last remaining farm can never be deleted.
- Each project has its own farm list.

## 4. Data scope

- Every farm-owned record has a `farmId` (done, see Phase 0). Users, password-reset codes and app-level settings stay global. The exact per-collection list is recorded in `PHASE1_PLAN.md`.
- The server enforces scope. A request is checked against the user's assigned farms; the farm picked in the screen is only a filter inside what the user may see.
- Indexes change to lead with `farmId` (for example `farmId` + `date`).
- Migration, per project: create "Farm 1" (rename later), tag all existing records with it, convert roles, assign workers. It must be safe to run twice, tried on a copy first, and preceded by a backup. Rollback means restoring the backup.

## 5. Server-side totals

Today the browser downloads records and adds them up. That is slow with thousands of records. With the paging and summary work (Phase 0) the browser asks the server a question ("profit for Farm 2 this month") and receives only the small answer.

- With one farm selected, only that farm's records are counted.
- With "All farms", the same calculation runs without the farm filter, or grouped by farm.
- Lists load as you scroll ("load more"), with search and filters on the server.

## 6. Shared MUF files

Shared code is identical in all three apps and guarded by `tools/check-muf-sync.js`.

| Kind | Planned location |
|---|---|
| Backend: farm rules, scope filter, roles, farms API, migration | `backend/muf-farms.mjs` (built, Phase 0) |
| Backend: save many rows at once | `backend/muf-bulk.mjs` |
| Backend: scroll loading and filters | `backend/muf-paging.mjs` |
| Backend: photo storage adapter | `backend/muf-storage.mjs` |
| Frontend: farm logic and context | `src/muf/domain/farms/` |
| Frontend: farm switcher, bulk table, scroll list | `src/muf/ui/` |
| Frontend: Farms & Access popup | `src/muf/admin/` |

Project-only features stay in their own project: Flock batches, Dairy breeding, Agri fields and seasons. Update `check-muf-sync.js` whenever a new shared file is added.

## 7. Super Admin

- It is an Owner-only tab, not a new site or domain.
- It already exists in all three apps (`SuperAdminTab`, `SuperAdminView`, `MyFarmsPanel`) and reads each project's key-protected `/api/farm-summary`, using `CROSS_FARM_KEY`.
- Phase 1 makes it Owner-only and shows each project's farms separately: milk, eggs, crops, revenue and expenses. Projects are never mixed into one total.

## 8. Photos

- Photos are compressed and size-limited, stored behind one adapter (`muf-storage.mjs`), and deleted with their record.
- The default store is the project's own MongoDB (Flock already has an `images` collection). The adapter lets us switch store by changing one file.
- Cloudinary's Free plan is the chosen first external store. The owner created the account on 2026-10-22; it is not connected to any app yet. Credentials go only in environment secrets, never in Git. Phases 8 and 9 build the adapter and connect it.

## 9. Flock structure

Batches become the main project; the old per-bird system becomes a small **Home Birds** tab.

- **Dashboard:** per farm and all farms.
- **Batches:** each batch is a group of birds in a shed (Broiler, Layer, Breeder or Custom). Daily entry of eggs, deaths, feed and weight as single numbers; one vaccination record for the whole batch; expenses, sales and profit and loss per batch.
- **Farms:** revenue, expenses and profit per farm, rolled up from batches.
- **Home Birds:** the bird list (add, edit, status), eggs, feed, expenses and simple vaccination. For about 50 birds or fewer. Exports, PDF, photo gallery, QR/waybill and similar extras may be removed here; the removed items are listed in `PROGRESS.md`.
- Customers, labor, suppliers, reports and settings stay.
- The old big-list data (birds, eggs, feed, expenses, vaccinations) moves into proper collections with `farmId` and `batchId`, because one JSON document per category hits size limits and save conflicts.

## 10. Dairy structure

- Farm switcher; workers assigned per farm.
- Milk sheet: one row per cow, Morning and Evening columns, saved at once. Shed-level entry when milk is not measured per cow. Bulk health: pick a group, a vaccine, apply to all. CSV/Excel import.
- Breeding events: heat, tikka/AI date, semen code, technician, pregnancy check, calving.
- Calving creates the calf automatically with gender, `motherId` and a father link. The father is either a farm bull (`sireId`) or an outside bull or straw (`sireName` and `semenCode`).
- Ear-tag number, unique per farm.
- Later: a "List on MU Farms" option for milk or animals with no buyer.

## 11. Agri structure

- Farm → Field (with acres) → Crop cycle (season).
- Every expense and income links to the farm, field and crop cycle, so profit is visible per field and per season.
- Load only what is needed (current farm, season, active crops) and archive finished crops. Add data checks and indexes.
- Workers are assigned per farm. Harvested produce can be published to MU Farms later.

## 12. MU Farms (later)

One shop with three sections (Crops, Dairy, Poultry). Each project gets a "Publish to MU Farms" switch on a product, so products are managed inside the three apps. There is no budget for a new domain, so the options are a clearly separated public section inside one of the apps or a separate free-subdomain site. Decide in Phase 16.
