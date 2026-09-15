# InsForge migrations

The top-level `migrations/` directory is the InsForge CLI migration path. The provider-specific drafts in `insforge/migrations/` and `supabase/migrations/` remain for their respective workflows.

The linked InsForge database already had its `flightstory` base schema when audited on 2026-09-15, but `insforge db migrations list` returned an empty history. The base schema therefore predates (or is outside) the CLI migration ledger. Do not replay migrations 0001–0005 or run `insforge db migrations up --all`: that can collide with existing objects. After confirming the remote schema and migration-history baseline, apply only these incremental targets, in order: `20260915080324_workspace-transcript-search.sql`, `20260915080328_shared-clip-review.sql`, and `20260915080400_workspace-search-quota.sql`. Never use `--all` against this baseline. Packaging these files does not mean they have been applied.

Migration 0008 adds a database-atomic fixed-window quota of 20 workspace search requests per authenticated user and workspace per 60-second window. It is enforced by `consume_workspace_search_quota()` after application membership validation and again inside the database function. This is a request-count limit, not a dollar-denominated model-spend cap. The function uses only `auth.uid()` and the workspace ID; callers cannot choose a higher limit or longer window. Its table is inaccessible to client roles, and only authenticated users may execute the membership-checked function.

The disposable local PostgreSQL integration check is `npm run test:quota:postgres`. It needs the cached `postgres:17` Docker image, creates a no-volume temporary container, and is intentionally not part of normal CI.
