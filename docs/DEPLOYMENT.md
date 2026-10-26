# Replit deployment and environment guide

Last reviewed: 2026-10-26. This guide documents repository configuration and the steps for rolling out the scale-up phases. It does not prove that a published Replit deployment is currently running; only the live checks below do.

## Project and port map

| Farm | Frontend folder | Backend folder | Backend listening port | Replit local-to-public port |
|---|---|---|---:|---|
| Agri | `agri_farm/frontend` | `agri_farm/backend` | 8000 | 8000 → 80 |
| Dairy | `dairy_farm/client` | `dairy_farm/backend` | 3000 | 3000 → 80 |
| Flock | `flock_farm/client` | `flock_farm/backend` | 3001 | 3001 → 80 |

Each backend listens on `0.0.0.0` and serves the built frontend from its app-specific `dist/` directory. Root `.gitignore` and the mirror script intentionally exclude build output. Replit must build the frontend in the deployment build step before starting the backend.

## Runtime and deployment commands

All three `.replit` files target Node.js 24 and set `NODE_ENV=production` for the published backend process. The deployment run commands use each backend's lockfile with `npm ci --omit=dev`; the build commands use the frontend lockfile and include development dependencies so Vite/TypeScript can build the static app.

- Agri: `frontend/` build, then `backend/` production start. `agri_farm/replit.nix` also selects Node.js 24.
- Dairy: `client/` build, then `backend/` production start.
- Flock: `client/` build, then `backend/` production start.

Do not delete the `package-lock.json` files. If a manifest changes, regenerate the matching lockfile with npm and verify `npm ci` succeeds before publishing. Do not copy a built `dist/` from a local machine or commit generated build output.

## Canonical environment-variable names

The three backends share `muf-env.mjs`; use the same variable names where the feature exists, but do not reuse every value.

### Common variables

| Name | Purpose | Value rule |
|---|---|---|
| `APP_URL` | Absolute public URL used for links and Telegram webhook registration | Use that farm's own URL, without a trailing slash |
| `FRONTEND_URL` | Allowed frontend origin(s) for CORS | Use that farm's own origin, without a trailing slash |
| `MONGO_URI` | MongoDB connection string | Use the correct, separate database for each farm |
| `JWT_SECRET` | JWT signing secret | Use a long, randomly generated, unique value for each farm |
| `CROSS_FARM_KEY` | Authentication between farm apps | Use the same high-entropy value in all three apps if cross-farm requests are enabled |
| `CRON_SECRET` | Protects external scheduled endpoints | Use a different strong value per farm; configure the external scheduler with the matching value |
| `JWT_EXPIRES_IN` | Lifetime of newly issued JWT tokens | Optional; examples: `1440m` or `7d`. All three backends normalize a bare integer as minutes |
| `TZ_OFFSET_HOURS` | Farm local-time offset from UTC | Use `5` for Pakistan Standard Time |
| `LOG_REQUESTS` | Extra request/auth diagnostic logging | Leave unset unless temporarily debugging |
| `CLOUDINARY_CLOUD_NAME` | Optional Cloudinary cloud name for photo uploads | Set in the deployment secret manager; never commit a real value |
| `CLOUDINARY_API_KEY` | Optional Cloudinary API key | Set in the deployment secret manager; never commit a real value |
| `CLOUDINARY_API_SECRET` | Signs Cloudinary server-side photo requests | Set in the deployment secret manager; never commit a real value |

`NODE_ENV=production` is set by each published deployment run command, so it does not need to be added as a secret. Do not set `PORT=80`: the backend must listen on its configured local port (8000/3000/3001). Normally the existing code default is sufficient.

### Email variables

Use the same names across any app that sends email:

- `SMTP_HOST=smtp.gmail.com`
- `SMTP_PORT=465` with `SMTP_SECURE=true`, **or** `SMTP_PORT=587` with `SMTP_SECURE=false`
- `SMTP_USER`, `SMTP_PASS`, and `SMTP_FROM`

For Agri, port 587 means explicitly set `SMTP_SECURE=false`. For Dairy and Flock, port 465 means explicitly set `SMTP_SECURE=true`.

Farm-specific recipient settings are separate:
- Dairy: `EMAIL_TO` for the email/cron route.
- Flock: `DAILY_SUMMARY_EMAILS` for daily-summary recipient allowlisting.
- Agri's scheduled reports use the recipient configuration expected by the automation route.

### Telegram variables

- `TELEGRAM_BOT_TOKEN`: use the token for that app's bot.
- `TELEGRAM_WEBHOOK_SECRET`: use a long random secret, unique per app.

Prefer a separate Telegram bot for each farm. Telegram allows one webhook URL per bot, so sharing one bot token across three independently deployed apps can make them overwrite each other's webhook registration.

### Agri-specific scheduler setting

`DISABLE_INTERNAL_SCHEDULER=1` disables Agri's in-process scheduler. Leave this set only when the required external cron/pinger is configured and tested. If there is no external scheduler, remove this setting or set it to a value other than `1` so the internal scheduler can start.

## Legacy aliases

The current shared loader supports older aliases for backwards compatibility:

| Legacy name | Canonical name |
|---|---|
| `SECRET_KEY` | `JWT_SECRET` |
| `SESSION_SECRET` | `JWT_SECRET` (only the JWT value is covered by this loader alias) |
| `MONGODB_URI` | `MONGO_URI` |
| `SMTP_SENDER` or `MAIL_FROM` | `SMTP_FROM` |
| `EMAIL_HOST` | `SMTP_HOST` |
| `EMAIL_PORT` | `SMTP_PORT` |
| `EMAIL_USER` | `SMTP_USER` |
| `EMAIL_PASS` | `SMTP_PASS` |

Migrate one project at a time. Copy the existing active value into the canonical variable, save it in the workspace Secrets and published deployment secrets, republish, then test login/email/database behavior. Remove legacy duplicates only after confirming no other app-specific code reads them directly and the published app behaves correctly. Changing a JWT secret value invalidates existing tokens and logs users out, so preserve the active secret when renaming it.

## Replit publishing checklist

For each farm independently:

1. Pull the latest `main` into the monorepo and confirm the intended app folder contains the latest changes.
2. Run `tools\\send-to-projects.bat` to push each matching project folder to its standalone GitHub repository.
3. Open the corresponding Replit project and pull/import the latest corresponding repository commit.
4. Confirm the workspace Secrets **and** published deployment secrets have the correct names and values. Never paste secret values into GitHub, issues, chat, or logs.
5. Inspect the deployment's build and run commands. The build must complete before the server starts.
6. Publish/republish the app and inspect the deployment logs for database, startup, CORS, SMTP, and Telegram errors.
7. Open the public URL and test: page loads (not the API-only fallback), login/logout, one database-backed read, one safe record save, email delivery when enabled, Telegram webhook/status when enabled, and each configured scheduled endpoint.
8. Verify scheduled jobs externally. A secret being set does not create an external scheduler; for example, disabling Agri's internal scheduler without setting up a pinger stops its scheduled reports.

Do not report a project as production-verified until these live checks pass. Passing GitHub Actions frontend builds does not test Replit Secrets, MongoDB reachability, SMTP delivery, Telegram webhook ownership, or Replit's current publishing quota.

## Rolling out a scale-up phase (farms, roles, restructure)

Phases 1, 2 and 4 change data. Follow these steps for each project separately, and do not start the next project until the first one is verified.

1. **Back up first.** Export or snapshot the project's MongoDB database and keep the copy outside the app. Check that the backup can be opened.
2. **Try it on a copy.** Restore the backup into a separate throwaway database, point a local copy of the app at it, and run the migration there. Check record counts before and after, and open the main screens.
3. **Run the migration once on live data**, only after the owner approves. Migrations are written to be safe to run twice, but do not rely on that.
4. **Publish** following the checklist above, then test: login as an owner, a manager and a worker; confirm a worker sees only assigned farms; add, rename and archive a farm; make one safe record save in each farm.
5. **Rollback** means restoring the backup and republishing the previous commit. Keep the backup until the owner has used the new version for a while.

Farm migration commands, run inside each project's backend folder with that project's MongoDB URI set (Dairy, Agri and Flock now have the script):

```
npm run migrate:farms:dry     shows what would change and changes nothing
npm run migrate:farms         creates "Farm 1", tags every record, converts admin to owner
```

The migration is safe to run twice. The server does not run it for you: until it has been run on real data, every request that needs a farm returns `MIGRATION_REQUIRED`. Demo (memory) mode runs it automatically.

Never run a migration against live data from a developer machine without the owner's go-ahead.

## Cloudinary photo storage

Phase 9 adds optional Cloudinary storage for new photos. Configure all three `CLOUDINARY_*` values in each app's workspace Secrets and published deployment secrets to enable it. If any value is missing, uploads continue using the MongoDB store and the backend logs one fallback message. Do not put real credentials in `.env`, `.env.example`, GitHub, chat, or logs. Existing MongoDB photo records remain readable; no automatic bulk migration occurs. Cloudinary-backed records retain a farm-scoped local API path, and the authenticated backend redirects photo reads to the Cloudinary HTTPS URL. If credentials are removed later, existing Cloudinary records can still be read but cannot be deleted from Cloudinary until credentials are restored.

Cloudinary's official documentation currently lists the Free Image & Video API plan at 25 credits. One credit equals 1,000 transformations OR 1 GB of managed storage OR 1 GB of image bandwidth, consumed in combination; transformations and bandwidth use a rolling 30-day window, while storage is a current total. The Free plan maximum image upload size is 10 MB. The app's own 100 KiB photo storage validation remains the stricter limit for current farm uploads. Verify current usage in Cloudinary Console > Settings > Billing. Sources: [Cloudinary billing and plans](https://cloudinary.com/documentation/billing_and_plans), [Cloudinary plan comparison](https://cloudinary.com/pricing/compare-plans).

## Free-tier limits to watch

- The free MongoDB tier has a small storage cap (usually 512 MB; check the cluster's dashboard). Photos stored in the database count against it. This is why photos are size-limited and why Phases 8 and 9 move them to an external store.
- Replit's local disk is not permanent on autoscale deployments, so nothing important may be stored as a local file.
- Re-check current free-tier limits on the providers' own pages before relying on them.

## Photo-storage configuration

The Cloudinary environment names are now read by all three backends. They are optional; the default MongoDB store remains active when any credential is absent. Use only placeholder values in the tracked `.env.example` files.

## Secret handling

Keep secrets in Replit Secrets or the deployment's secret manager. Never commit a real `.env`, connection string, JWT secret, SMTP password, Telegram token, cron secret, or cross-farm key. The tracked `.env.example` files must contain placeholders only.
