# Dairy Farm

Dairy Farm manages cattle, milk, breeding, health, buyers, suppliers, labor and expenses.

## Layout and local use

- Frontend: client/
- Backend: backend/
- Local URL when using the root start script: http://localhost:3000

Start with the developer guide at ../docs/DEVELOPER_START.md. It lists reproducible installs, repository checks, build/start order and development-only workbench instructions. See ../docs/USER_GUIDE.md for role boundaries and data-entry workflows, and ../docs/FARMS_AND_ROLES.md for server-side farm scope.

Cow records, daily milk, breeding events, calves/lineage, health, buyer/supplier ledgers, labor and expenses are dairy-specific. Shared MUF components and tokens live under client/src/muf/ and the muf-style.css entry. Keep shared MUF twins synchronized with Agri and Flock.

Changes are planned phase by phase. Back up before migrations; do not remove features, alter live data, publish or sync to standalone mirrors without the owner's required approval. Read ../RULES.md. See ../docs/DEPLOYMENT.md, ../docs/PROGRESS.md, and ../docs/ROADMAP.md.
