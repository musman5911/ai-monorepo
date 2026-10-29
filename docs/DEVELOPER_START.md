# Developer start and validation guide

This guide applies to the monorepo checkout. App-specific READMEs are short orientation pages; this is the authoritative local development setup.

## 1. Read before editing

1. Read RULES.md, docs/PROGRESS.md, docs/ROADMAP.md, and the phase file for the task.
2. Confirm the current branch and that you will not overwrite local work.
3. Work on the explicitly selected work branch. The current scale-up workstream uses muf-monorepo; don't blindly switch to main or another branch.
4. Do not deploy, run mirror sync, modify live data, or run a migration without the owner's explicit approval.
5. Make one reviewable commit per logical change, then inspect its GitHub Actions run.

## 2. Install the dependency sets

From a Windows CMD terminal opened at the repository root, run npm ci for the root and each independent app package folder. Backend installs are required by farm-scope/runtime checks; frontend installs provide reproducible build dependencies. Do not hand-edit lockfiles.

```cmd
git status --short --branch
git pull --ff-only origin muf-monorepo
npm ci
cd /d dairy_farm\backend
npm ci
cd /d ..\client
npm ci
cd /d ..\..
cd /d flock_farm\backend
npm ci
cd /d ..\client
npm ci
cd /d ..\..
cd /d agri_farm\backend
npm ci
cd /d ..\frontend
npm ci
cd /d ..\..
```

If you are on a different explicitly assigned branch, use that branch name in the pull command. Stop and inspect git status if the tree is not clean.

## 3. Run the repository checks

Run these from the repository root:
```cmd
npm run check-sync
npm run check-ui
npm run check-workbench
npm run check-farms
npm run check-docs
npm run check-audit
npm test
tools\build-all.bat
```

The automatic GitHub Actions workflow runs quick checks on push and pull request. The full app build is still an explicit local gate. check-audit checks high/critical production dependency findings in each package set; it does not replace reviewing advisories before release.

## 4. Build and start the apps

For a production-style local preview, run tools\build-all.bat from the root, wait for results for all three apps, then run tools\start-all.bat. The start script launches backends that serve each app's built frontend. It does not watch/rebuild frontend source files.

For a focused frontend edit, run the dev server inside that frontend folder. Example, the Dairy Vite server and workbench:
```cmd
cd /d dairy_farm\client
npm run dev
```

Open http://localhost:5000/__muf-workbench for the development-only workbench. Do not expose it through a backend/production route. It exports reviewable files; apply approved files manually and run shared parity/UI checks.

## 5. Shared code and phase workflow

- Search for an existing MUF component/helper before adding a duplicate.
- If shared components or stylesheets change, update required twins and run npm run check-sync.
- Keep farm-specific calculations and permissions in the correct app.
- Every phase needs a command-line check, a truthful validation record, and consistent status in PROGRESS, ROADMAP and the phase index.
- Passing source tests/builds does not prove live MongoDB, browser, phone, CORS, email, Telegram, or deployment behavior. Those belong to the final-testing phases.

## 6. Useful references

- User workflows and roles: USER_GUIDE.md
- Farms and roles policy: FARMS_AND_ROLES.md
- Deployment and secrets: DEPLOYMENT.md
- Workbench details: WORKBENCH.md
- Progress and next work: PROGRESS.md, ROADMAP.md, phase index: phases/README.md
