# InsForge migrations

The top-level `migrations/` directory is the InsForge CLI migration path. The provider-specific drafts in `insforge/migrations/` and `supabase/migrations/` remain for their respective workflows.

The linked InsForge database already had its `flightstory` base schema when audited on 2026-09-15, but `insforge db migrations list` returned an empty history. The base schema therefore predates (or is outside) the CLI migration ledger. Do not replay migrations 0001–0005 or run `insforge db migrations up --all`: that can collide with existing objects. The timestamped top-level 0006 and 0007 files are the reviewed feature migrations; apply them only as explicit targets after confirming the remote schema and migration-history baseline. Packaging these files does not mean they have been applied.
