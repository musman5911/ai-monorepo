# MUF Farm Apps Monorepo

The source of truth for three independent farm-management web apps: Agri Farm, Dairy Farm, and Flock Farm. Each app has its own frontend and backend; MUF is the shared frontend design system.

## Projects

| Project | Frontend | Backend | Local URL when using the root start script |
|---|---|---|---|
| Agri Farm | agri_farm/frontend | agri_farm/backend | http://localhost:8000 |
| Dairy Farm | dairy_farm/client | dairy_farm/backend | http://localhost:3000 |
| Flock Farm | flock_farm/client | flock_farm/backend | http://localhost:3001 |

tools\start-all.bat starts the three backend servers. Each backend serves the app's built frontend, so run the build first after making frontend changes. The script also prints LAN URLs for phones on the same Wi-Fi.

## Quick start on Windows

Read docs/DEVELOPER_START.md for the full reproducible dependency-install setup, role boundaries, workbench instructions, and validation sequence. If the required packages are already installed, run the following commands from the monorepo root on the current work branch, muf-monorepo:

```cmd
git status --short --branch
git pull --ff-only origin muf-monorepo
npm run check-sync
npm run check-ui
npm run check-workbench
npm run check-farms
npm run check-docs
npm test
npm run check-audit
tools\build-all.bat
```

The commands are repository-root commands unless a guide explicitly tells you to change directories. The build-all script builds all three frontends and may install missing frontend packages. Read its output carefully: its fallback can build with Vite after TypeScript errors, so a Vite-only fallback is not the same as a fully type-checked build.

## Workbench

The custom MUF workbench is development-only. From a separate terminal:
```cmd
cd /d dairy_farm\client
npm run dev
```

Open http://localhost:5000/__muf-workbench. It uses sample content, keeps drafts in your browser, and exports reviewable CSS/JSON. It does not write to farm APIs or apply styles to production automatically. Run npm run check-workbench from the repository root for its source-safety checks.

## Documentation map

- Developer start and validation: docs/DEVELOPER_START.md
- User guide: docs/USER_GUIDE.md
- Repository rules: RULES.md
- Farms and roles: docs/FARMS_AND_ROLES.md
- Deployment: docs/DEPLOYMENT.md
- MUF overview and design rules: docs/MUF_OVERVIEW.md, docs/muf-rules.md, docs/WORKBENCH.md
- Progress: docs/PROGRESS.md
- Roadmap and phase index: docs/ROADMAP.md, docs/phases/README.md

## Folder map

- agri_farm/, dairy_farm/, flock_farm/: the three independent applications.
- docs/: user/developer guides, deployment notes, decisions and phase records.
- tools/: build/start scripts, source checks, documentation checks and repository utilities.
- tests/: root Vitest regression suite.

## Project boundaries

Keep all three apps separate, including their users, farms, databases, and deployments. Work phase by phase, back up before migrations, ask before removing an existing feature, and do not deploy or sync standalone live mirrors without the owner's explicit approval. Read RULES.md before making changes.
