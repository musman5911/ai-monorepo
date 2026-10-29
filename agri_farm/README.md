# Agri Farm

Agri Farm manages crops, fields, crop cycles, farm finance, inventory, labor and suppliers.

## Layout and local use

- Frontend: frontend/
- Backend: backend/
- Local URL when using the root start script: http://localhost:8000

Start with the developer guide at ../docs/DEVELOPER_START.md. It lists reproducible installs, repository checks, build/start order and development-only workbench instructions. See ../docs/USER_GUIDE.md for role boundaries and data-entry workflows, and ../docs/FARMS_AND_ROLES.md for server-side farm scope.

Crop cycles and fields, finance/ledger, input inventory, suppliers, labor, and Zakat/Ushr are agriculture-specific. Shared MUF components and tokens live under frontend/src/muf/ and the muf-style.css entry. Keep shared MUF twins synchronized with Dairy and Flock.

Changes are planned phase by phase. Back up before migrations; do not remove features, alter live data, publish or sync to standalone mirrors without the owner's required approval. Read ../RULES.md. See ../docs/DEPLOYMENT.md, ../docs/PROGRESS.md, and ../docs/ROADMAP.md.
