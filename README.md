# FlightStory Archive

An independent prototype exploring how a public-source archive of Diary of a CEO episodes could help a researcher follow an idea back to its source moment. It is not affiliated with, endorsed by, or an official product of FlightStory, Steven.com, or The Diary Of A CEO.

Public Vercel defaults to a three-excerpt demo. Workspace search is a separate, fail-closed mode and is not ready for real internal content until its database migration, workspace membership, and approved corpus are provisioned.

## What works today

- Browse the generated public topic and episode graphs.
- Search three built-in public-source examples with local keyword matching. AI synthesis is available only in the signed-in workspace path.
- Inspect citations and open their linked YouTube moments.
- Create local clip drafts from cited moments, adjust in/out times, and mark a draft reviewed on this device.
- Keep drafts in this browser's local storage; they are not shared, rendered, or exported as video.
- See index counts from the catalogue and generated graph data.

The public demo never sends questions to OpenAI: it locally matches against three built-in excerpts. This avoids an anonymous, unbounded provider-spend path. Workspace synthesis sends a question and matched transcript excerpts to OpenAI only after the server verifies the user's session and workspace membership. The interface shows transcript excerpts as **provisional**. Episode metadata and timestamps are not a guarantee that a quote, speaker, or interpretation has been independently verified. Check the source video before relying on a result.

Workspace mode sends the short-lived InsForge access token to the server. The server validates the session and checks membership in one configured workspace before calling an RLS-protected search function. Sign-in does not create a workspace or grant membership. Workspace synthesis is split into short claims, each linked to one source ID and an exact quote verified against that retrieved segment; invalid claims fall back to cited excerpts. Responses API application-state storage is disabled with `store: false`; OpenAI provider safety or abuse-monitoring retention is still governed by the account's data policy. Missing workspace, approved transcript data, or search function makes workspace search unavailable; it never falls back to demo or local data.

## Data and rights

The repository includes public episode metadata and generated graph files. A full search index may exist locally at `data/search-index.json`; `.gitignore` excludes it because it contains sampled transcript text. Vercel excludes both index paths, and the server explicitly returns 404 for the historical `public/search-index.json` path even if that file reappears in a checkout. Public demo search uses only the three built-in examples. Workspace search retrieves approved, canonical transcript segments through the InsForge RLS search function; it never falls back to the local file.

To create a local index from a dataset you are authorised to use:

```sh
node scripts/build_search_index.mjs /path/to/episodes data/search-index.json
```

The script expects episode JSON files containing `id`, `url`, `title`, and `segments`, plus matching metadata files at `../raw/<id>.info.json`; it keeps records whose channel ID matches the Diary of a CEO channel. The index contains sampled transcript text. Public availability of an episode or caption is not permission to redistribute its transcript. Do not commit the generated index unless its contents are cleared for distribution.

**Public-release blocker:** an earlier Git commit contains `public/search-index.json`. Deleting or ignoring the current file does not remove it from Git history. Before changing this repository's visibility, either establish rights to every excerpt in that historical index or prepare a clean history/repository without it.

The catalogue source is `catalog/episodes.json`; the browser-facing metadata and graph snapshots are under `public/`.

### Approved caption ingestion

`scripts/transcribe_catalog.mjs` requires a separately prepared rights-approved source manifest as its first argument. It accepts only catalogue episodes marked eligible for transcription, checks the exact YouTube video and expected channel with `yt-dlp` metadata, and only then requests English auto-captions. It does not download video. No approvals or real video IDs are stored in this repository.

Manifest shape:

```ts
{
  sources: Array<{
    episodeId: string;          // catalogue episode ID; must be transcription-eligible
    videoId: string;            // exact YouTube video ID
    channelId: string;          // expected YouTube channel ID
    rightsStatus: "approved";
    approvalReference: string;  // non-empty reference to the approval record
  }>;
}
```

Run it from the repository root:

```sh
node scripts/transcribe_catalog.mjs /path/to/approved-source-manifest.json [raw-output-directory] [progress-file]
```

The raw-output directory defaults to `data/raw`; the progress file defaults to `data/raw/catalog-progress.json` (or `<raw-output-directory>/catalog-progress.json` when a custom raw directory is supplied). Progress resumes only when the video ID, channel ID, and approval reference still match the manifest.

## Run locally

Requires Node.js 24 and npm.

```sh
npm ci
npm run dev
```

Open <http://localhost:3000>.

`npm run dev` builds the interactive graph bundle and starts the server. Public demo search always stays local, even when `OPENAI_API_KEY` is set. Workspace synthesis requires `SEARCH_ACCESS_MODE=workspace`, an explicitly configured workspace, verified membership, an approved transcript corpus, and `OPENAI_API_KEY`. Copy `.env.example` to `.env` for local setup. The server sends workspace questions and matched transcript excerpts to OpenAI; the browser does not receive the OpenAI key. Keep `.env` and `.env.local` out of Git.

Workspace mode requires `NEXT_PUBLIC_INSFORGE_URL`, `NEXT_PUBLIC_INSFORGE_ANON_KEY`, `SEARCH_ACCESS_MODE=workspace`, and a provisioned `FLIGHTSTORY_WORKSPACE_ID`. The URL and anon key are publishable client settings, not authorization. The server uses the user bearer token and RLS; it does not use an admin key.

## Checks

```sh
npm run check
npm test
npm run build
```

Workspace search tests inject a synthetic corpus and mock auth/search responses; they do not need real transcript data or live InsForge credentials. The Node.js 24 GitHub Actions workflow has passed on PR #1 and on the merged main branch; those checks do not validate live InsForge auth or RLS.

## Release notes

- No `LICENSE` file is included, so reuse terms for the code are unspecified.
- The API has request-size, per-process rate, and timeout controls. The in-memory rate limit is not a cross-instance or spend guarantee.
- Public demo clip drafts support local boundary edits and local review state only. Authenticated board and clip-review UI/API plus migration 0007 are implemented in code, but demo mode keeps them closed, the migration is unapplied, and no live authenticated workspace test exists. Clip rendering/export is not implemented.
- The shared board clip list is currently unpaginated; add paging before large-team use. Workspace claims require an exact transcript quote verified against a retrieved segment, and Responses API application-state storage is off; provider safety or abuse-monitoring retention remains governed by the account's data policy.
- The static graph and catalogue contain public-source metadata. They are not protected by database row-level security.
- Public Vercel is demo-only and includes no full transcript index. InsForge CLI migrations are under the top-level `migrations/` folder and contain only incremental workspace-search and shared-review changes. The live base schema predates the empty CLI migration ledger; `docs/INSFORGE_MIGRATIONS.md` explains why the old base migrations must not be replayed. A disposable PostgreSQL 17 test accepted both new migrations and exercised synthetic create/save/edit/submit/review flows; InsForge-specific execution is still unverified. Workspace mode still needs migrations 0006/0007 applied to InsForge, a provisioned workspace and member list, and approved canonical transcript rows.
- The live InsForge database currently has no workspaces, members, episodes, transcript versions, or segments; workspace mode will fail closed until these are provisioned through the approved ingestion workflow.
- Do not describe this prototype as production-ready or as handling private workplace data.
