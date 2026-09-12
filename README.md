# FlightStory Intelligence

An evidence-first internal intelligence layer for the Diary of a CEO archive: ask a question, inspect the supporting moment, open the exact YouTube timestamp, and save a clip candidate.

## Current state

- Steven.com-inspired research workspace is live at https://flightstory-intelligence.vercel.app.
- Search works against labelled demo evidence and refuses empty topics.
- Timestamp links and persistent clip queue are implemented.
- The repository is private and pushed to https://github.com/CashpointSoulja/flightstory-intelligence.
- The portable Supabase migration is in `supabase/migrations/0001_flightstory_core.sql`.
- Supabase project provisioning is pending the `Special Projects` organisation becoming available.

## Run locally

```bash
npm run dev
```

Open http://localhost:3000.

```bash
npm run check
```

## Product boundary

The target archive is DOAC episodes from March 2023 onward, not every channel upload. The catalogue must classify long-form episodes separately from clips, shorts, trailers, and other videos before ingestion.

Every episode needs an explicit source and rights state:

- `catalogued`: metadata only
- `transcript-only`: searchable and citable, no owned render source
- `renderable`: approved source video is in private storage
- `blocked`: source or rights are not safe to process

## Architecture

```text
Vercel UI/API → Special Projects Supabase
                         ↓
             durable ingestion worker
                         ↓
       transcript → segments → embeddings → graph
                         ↓
            grounded answer + reviewed clips
```

Long transcription and video rendering must stay outside a short Vercel request. Provider keys and privileged database keys remain server-only.
