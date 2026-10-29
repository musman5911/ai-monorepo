# Flock Farm

Flock Farm manages poultry batches, Home Birds, eggs, feed, incubation, health, sales and farm finance.

## Layout and local use

- Frontend: client/
- Backend: backend/
- Local URL when using the root start script: http://localhost:3001

Start with the developer guide at ../docs/DEVELOPER_START.md. It lists reproducible installs, repository checks, build/start order and development-only workbench instructions. See ../docs/USER_GUIDE.md for role boundaries and data-entry workflows, and ../docs/FARMS_AND_ROLES.md for server-side farm scope.

Batches are the main production workflow. The smaller Home Birds area is for simple household/small-flock records; eggs/feed/expenses can be entered through batch logs or the appropriate farm-wide Finance sections. Shared MUF components and tokens live under client/src/muf/ and the muf-style.css entry. Keep shared MUF twins synchronized with Agri and Dairy.

Changes are planned phase by phase. Back up before migrations; do not remove features, alter live data, publish or sync to standalone mirrors without the owner's required approval. Read ../RULES.md. See ../docs/DEPLOYMENT.md, ../docs/PROGRESS.md, and ../docs/ROADMAP.md.
