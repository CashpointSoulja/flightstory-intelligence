# FlightStory Intelligence — product plan

Status: MVP definition and architecture baseline, 12 September 2026

## Live implementation state — checked 15 September 2026

- Public app: https://flightstory-intelligence.vercel.app. Its live `/api/config` reports `searchAccessMode: demo`; the three built-in examples are the only searchable corpus in this mode. Public demo matching stays local and never calls OpenAI. Workspace AI synthesis is reserved for signed-in users whose workspace membership is verified.
- Workspace code path: requires a valid signed-in session, exact membership in the configured workspace, and the RLS-protected `search_transcript_segments` RPC. It can synthesize up to six short claims; each requires a verbatim quote and source ID, and the server checks the quote appears in that retrieved segment. Responses API application-state storage is disabled with `store:false`. Missing access or corpus fails closed; it never falls back to public demo data.
- InsForge read-only counts: 0 workspaces, 0 members, 0 episodes, 0 rights-approved/ready episodes, 0 transcript versions, 0 canonical transcript versions, 0 transcript segments, 0 research boards, 0 clips, and 0 processing jobs. Therefore workspace search has no usable internal corpus or members today.
- Product gaps: the public demo can create locally saved clip drafts, edit their range, and mark them reviewed on this device; these are not shared team decisions or rendered clips. Citation results now show their full source window. Shared-review APIs return safe `canEdit`/`canReview` flags so the UI does not offer actions that the creator/member/owner role cannot perform; database RPCs remain authoritative. A signed-in workspace board/review UI, API routes, and migrations 0006/0007 are packaged in code, but demo mode keeps them closed and the live InsForge ledger has not recorded the migrations. Local SQL integration and mocked workspace browser flow pass, but there is still no live authenticated InsForge/RLS test; the database has zero workspaces or corpus rows. The public corpus is one source with three excerpts. Source rights and transcript retention are not operationally approved. Board clip listing needs pagination before large-team use. A durable media worker and observed producer pilot remain absent. The API limiter is per-process, not a shared quota. Do not call this production-ready or an internal creator-technology system.
- Repository release blocker: GitHub repo remains `PRIVATE`, and historical Git contains `public/search-index.json` (confirmed at commit `8133be0`). Keep the repo private until rights to that historical transcript text are established or the history is cleaned.
- Latest release loop: GitHub PRs #1–#4 are merged to `main`; the current Vercel production build is Ready. The three map-layer controls now filter Topics, Graph videos, and Evidence; Focus Evidence selects the Evidence layer. Controls stay disabled until the graph module binds, and clicks during data loading are queued. Browser QA verified all layer states, the accessible link list, and no console errors. Search shows provisional source windows, and `icebreaker` / `ice breaker` resolve to the cited conversation-starter moment. The local draft flow was tested through create, edit, review, and remove, ending with zero test drafts. Mobile at 390px has no horizontal overflow and citation metadata renders at 10px. Production remains demo-only with one transcript source and three searchable excerpts; shared-board routes and `/search-index.json` return 404.
- Verification: `npm test` passes 64/64; `npm run check`, `npm run build`, `git diff --check`, disposable PostgreSQL 17 migration/runtime tests, Vercel package inspection, cold-load preview tests, production browser QA, and GitHub Actions CI pass. The local SQL test exercised synthetic board creation, clip save/edit/submit, admin review, and creator self-review denial. These checks do not prove live InsForge RLS/auth behavior or a real producer pilot.
- Source sync: PRs #1–#4 are merged; `main` and the working tree are synchronized. The main tree no longer tracks `public/search-index.json`, and `.gitignore` blocks regenerated copies. GitHub remains private because older commits still contain the historical index. Do not change visibility until rights are established or that history is removed.

## Product in one line

Ask the DOAC archive anything and get an evidence-backed answer that points to the exact second of the exact episode, with a YouTube link and a path to create a reviewed clip.

## MVP scope

The MVP archive target is every Diary of a CEO episode published from March 2023 onward.

The MVP must support:

- timestamped transcript search
- real LLM answers grounded only in indexed archive evidence
- exact episode, guest, excerpt, start/end time, and YouTube deep link
- refusal when the archive cannot support an answer
- saved research boards
- clip candidates with editable boundaries and human approval
- discovery of similarities, contradictions, and surprising cross-topic connections
- explainable ranking of moments that may work as content hooks
- archive/indexing status and processing failures

It is an internal creator-technology product, not a public chatbot.

## Users and jobs

| Team | Job |
|---|---|
| Production / research | Find prior coverage, contradictions, gaps, and useful questions. |
| Social / clips | Find strong moments quickly and turn them into reviewed clip briefs. |
| Comms / PR | Check whether a claim is actually supported before publishing. |
| Commercial | Find relevant guest praise, product mentions, and sponsor-safe moments. |

Primary retention loop:

```text
New episode indexed
  -> archive becomes more useful
  -> team searches it for real work
  -> results become boards, citations, and clips
  -> feedback improves ranking
  -> more teams depend on the archive
```

## Core workflows

### 1. Ask the archive

Question -> retrieve transcript segments -> LLM synthesis -> citation validation -> answer with clickable timestamps.

Every claim shown to a user must point to one or more exact transcript segments. If no segment supports it, the answer is refused.

### 2. Find and review a clip

User asks for a topic, emotion, hook, or format. The system returns ranked moments with:

- episode and guest
- start and end seconds
- transcript
- suggested title and hook
- why the moment may work
- YouTube link
- review status

The LLM suggests candidates. A human approves boundaries and export.

### 3. Compare and connect

The system can surface:

- similar ideas expressed by different guests
- direct or soft contradictions
- a shared theme across distant subject areas
- an unusual connection between clips with low keyword overlap
- topics that appear repeatedly but have not been explicitly tagged

“Random connection” means explainable serendipity: low surface similarity plus a meaningful shared latent concept, rhetorical pattern, emotion, or audience problem. It is not an arbitrary random number.

### 4. Cultural signal and hook radar

The system can compare archive moments against current external topic signals and historical performance data, then show why a moment is worth review.

It must say “high hook fit” or “matches this current topic signal,” not promise virality. Virality is a human/editorial outcome, not a guaranteed model prediction.

## Product shape

```text
┌───────────────┬───────────────────────────────┬──────────────────┐
│ ARCHIVE       │ ANSWER                        │ EVIDENCE         │
│ Episodes      │ Synthesised answer            │ Episode / guest  │
│ Guests        │                               │ Transcript       │
│ Topics        │ [Compare] [Save] [Clip]       │ Timestamp ▶      │
│ Boards        │                               │ Review status    │
└───────────────┴───────────────────────────────┴──────────────────┘
```

The graph is a browsing and discovery layer. Search, lists, transcripts, and timestamps remain the reliable work surface.

## Visual direction

Borrow Steven.com’s visual language, not its marketing-site interaction model.

- near-black space: `#0B0B0D`
- raised surface: `#131419`
- primary text: `#F4F2EE`
- secondary text: `#A8A8AE`
- lilac knowledge relationships: `#B88CFF`
- mint verified evidence: `#A7F3D0`
- amber review/uncertainty: `#FFD166`
- coral unsupported/error: `#FF6B61`

Typography:

- display: Host Grotesk or a similar custom-feeling sans
- interface/body: highly legible sans
- metadata/timestamps: restrained monospace or Field Gothic-style face
- decorative face only for annotations, never for controls or evidence

Interaction rules:

- evidence surfaces are calm and solid, not all glass
- constellation lines are thin and low-opacity until selected
- active relationships brighten; inactive relationships recede
- graph always has a list alternative
- timestamps are primary interaction targets, with visible focus states
- no autoplay audio
- reduced motion removes pulses and node travel
- decorative graph canvas is `aria-hidden`; accessible rows carry the information

## Technical architecture

```text
GitHub
  -> Vercel: Next.js + TypeScript UI and short API routes
  -> InsForge: Auth + Postgres + pgvector + private Storage
  -> Trigger.dev: durable ingestion, transcription, embeddings, graph extraction, FFmpeg
  -> AssemblyAI: canonical word timestamps and provisional speaker labels
  -> OpenAI: server-side grounded synthesis, extraction, ranking
```

Use TypeScript across the main product and worker. Use SQL for migrations and database functions. Use Python only if a specific local transcription tool requires it.

Do not run two-hour transcription or video rendering inside a Vercel request. Use Trigger.dev for queued long-running work, retries, progress, and concurrency limits.

## Ingestion and transcription

Normal product operation should not depend on the Mac being switched on.

1. Catalogue official episode IDs and metadata from March 2023 onward.
2. Obtain authorised source video/audio files or approved source URLs.
3. Upload source media directly to private InsForge Storage.
4. Trigger a durable job that uses FFmpeg to create 16 kHz mono audio and a smaller proxy video.
5. Send audio to AssemblyAI for word-level timestamps, confidence, utterances, and provisional speaker labels.
6. Keep the original provider response and any corrected transcript separately.
7. Generate timestamped segments, hybrid search fields, and embeddings.
8. Extract topics, entities, claims, hooks, emotions, rhetorical patterns, and possible clip windows.
9. Store provenance, model, version, timing source, source hash, and processing status.

YouTube auto-captions are useful for a read-only breadth seed, but production ingestion should use authorised source files. YouTube policies restrict downloading/storing audiovisual content without permission, and captions do not guarantee correct names or speaker turns. Keep source-file time and YouTube time distinct because edits can shift clocks. Without authorised source video, search and timestamp links are possible, but reliable rendered clips are not.

Recommended MVP provider split:

- AssemblyAI for canonical transcription output because word timing and diarisation are part of the required contract.
- OpenAI for grounded answers, claim extraction, comparisons, connection explanations, and clip reasoning.
- Local Whisper/faster-whisper only as a QA benchmark or offline fallback, not as a requirement for normal product operation.

Use idempotency keys such as `episode_id + source_hash + transcription_model` so retries do not create duplicate transcripts or charges.

## Database shape

Canonical tables in the `flightstory` schema:

- `episodes`
- `episode_assets`
- `transcript_segments`
- `transcript_words`
- `topics`
- `entities`
- `claims`
- `knowledge_edges`
- `research_queries`
- `citations`
- `clip_candidates`
- `clips`
- `saved_boards`
- `saved_items`
- `processing_jobs`
- `trend_signals`
- `feedback_events`

Rules:

- every segment belongs to one episode
- every citation points to an exact segment
- every citation has start and end seconds
- every clip has editable start and end seconds
- no answer is marked verified without validated citations
- source video and exported clips are private storage objects
- all exposed tables have RLS
- service-role keys are server-only

## Connection and serendipity model

Start with Postgres + pgvector and explicit edge rows. Do not add a graph database until the archive size or query latency proves it necessary.

Useful edge types:

- `semantic_similarity`
- `shared_topic`
- `shared_entity`
- `same_claim_different_position`
- `shared_emotion`
- `shared_hook_pattern`
- `temporal_topic_shift`
- `cross_domain_analogy`

Each edge stores its evidence, score, extractor version, and explanation. A connection must be inspectable by opening the source moments.

## Hook and cultural ranking

Rank clip candidates using separate, explainable signals:

- clarity of the first sentence
- tension or unanswered question
- emotional movement
- novelty inside the archive
- relevance to the user’s selected topic
- quotability and context completeness
- historical audience response, when available
- current cultural-topic fit, when available

Show the reasons behind the score. Never display a single unexplained “viral score.”

## Hosting and repository plan

- GitHub is the source of truth.
- `main` maps to production.
- feature branches and pull requests map to Vercel previews.
- Vercel hosts the web app and short server requests.
- The configured Postgres backend is intended to store database records, vectors, auth, and private files.
- A background worker handles long media jobs and retries.

The current connected GitHub MCP exposes file and commit operations but no repository-creation operation. Create the private repository through the connected GitHub account or CLI only after confirming the destination, then connect that repository to Vercel.

InsForge is the active MVP backend. Keep the SQL migrations and provider adapters portable so the product can move to Supabase, Neon, or another Postgres backend later without changing the product model.

## Portable backend fallback

InsForge is the active backend. If it ever becomes unsuitable, use a portable fallback without changing the product model:

```text
Vercel app
  -> Neon Free PostgreSQL + pgvector
  -> Cloudflare R2 for large media
  -> GitHub Actions for controlled batch jobs
```

The existing SQL contract is PostgreSQL-shaped, so Neon is the closest replacement. Keep the same table names, IDs, timestamps, migration files, server-only environment variables, and private-media boundary. Only the database/storage adapters should change.

Keep the same table names, IDs, timestamps, migration files, server-only environment variables, and private-media boundary. Only the database/storage adapters should change.

## Audit and review gates

Architecture and design are reviewed continuously, not only at the end.

### Gate 1 — before schema work

- shared data contracts agreed
- ownership and permissions mapped
- migration and rollback path written
- no unnecessary service or dependency added

### Gate 2 — after first real episode

- transcript timing checked against source
- names and speaker uncertainty labelled
- five known questions tested
- unsupported question correctly refused

### Gate 3 — after graph extraction

- every connection has an explanation and source moments
- distant connections are useful, not decorative noise
- graph has an accessible list alternative
- query latency and index cost measured

### Gate 4 — before clip export

- start/end boundaries match source video
- transcript and clip are aligned
- human approval is required
- output is private until explicitly shared

### Gate 5 — before pilot

- sign in/out works
- RLS blocks cross-user private data
- browser bundle contains no secret keys
- persistent boards survive reloads
- interrupted jobs retry without duplicates
- Vercel deployment is behaviourally verified

## Success measures

Initial targets:

- first useful citation in under 30 seconds
- over 80% of citations clicked or confirmed
- over 60% of searches produce a save, share, or clip
- at least three internal teams use it weekly
- 20+ minutes saved per validated research task
- processing failures visible and recoverable

The final proof is behavioural: real tasks completed, evidence opened at the correct moment, clips matching their boundaries, and measured time returned.

## Deliberately deferred

- automatic social publishing
- autonomous editing without human approval
- unverified speaker attribution
- public access
- multi-tenant customer architecture
- a separate graph database
- a fleet of specialised agents
- guaranteed virality predictions

Add these only when usage, accuracy, scale, or operational evidence justifies them.
