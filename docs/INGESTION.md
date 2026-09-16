# Archive ingestion runbook

## Goal

Index long-form Diary of a CEO episodes published from March 2023 onward. Do not treat every channel upload as an episode: exclude clips, Shorts, trailers, promos, and duplicate edits.

## Source states

Every catalogue record must carry one of these states:

- `catalogued`: metadata only
- `transcript-only`: approved transcript and timestamps, but no owned render source
- `renderable`: approved source media is available in private storage
- `blocked`: source, rights, or timing is unsafe

YouTube timestamps are valid for opening the public episode. They are not proof that the product owns a renderable video file.

## Transcript parser

Transcript normalization is provided by a local tool outside this repository; no parser implementation or workstation-specific path is bundled here. Its output should preserve:

- YouTube rolling-caption duplication
- inline word timestamps
- cue boundaries based on timing lines
- HTML-escaped speaker markers
- pause-based segments
- overlapping retrieval chunks

Keep raw captions and normalised transcript output separate. Do not copy any local `.env` file or credential into this repository.

## Local script paths

Run scripts from the repository root. Their defaults use `data/episodes`, `data/raw`, and `public/`; supply arguments when your local dataset lives elsewhere:

```sh
node scripts/transcribe_catalog.mjs <approved-source-manifest.json> [raw-output-directory] [progress-file]
node scripts/build_search_index.mjs [episodes-directory] [output-file]
node scripts/build_archive_graph.mjs [episodes-directory] [output-file]
node scripts/build_semantic_video_graph.mjs [episodes-directory] [output-file]
node scripts/build_topic_graph.mjs [episode-json-file] [output-file]
```

The transcription script requires `yt-dlp` on `PATH` and an explicit manifest as its first argument. Each `sources` entry has `episodeId`, `videoId`, `channelId`, `rightsStatus: "approved"`, and a non-empty `approvalReference`. The episode must be marked `eligibleForTranscription` in `public/catalog.json`; the script verifies yt-dlp's video and channel IDs before requesting captions. Raw output defaults to `data/raw`; progress defaults to `<raw-output-directory>/catalog-progress.json`.

### YouTube caption method (verified 2026-09-17)

For an approved, identity-checked video, use yt-dlp to fetch metadata and English captions without downloading the video:

```sh
yt-dlp --no-playlist --skip-download --dump-single-json --no-warnings "https://www.youtube.com/watch?v=<VIDEO_ID>"
yt-dlp --no-playlist --skip-download --write-auto-subs --sub-langs 'en.*' --sub-format vtt --write-info-json -o 'data/raw/%(id)s' "https://www.youtube.com/watch?v=<VIDEO_ID>"
```

This was tested against `q2cg1gEYWJQ`: yt-dlp returned the expected channel ID, 8,785-second duration, 30 chapters, and both `en-orig` and `en` VTT captions. Chapter titles and descriptions are useful metadata for discovery and editorial context; they are not a transcript and must not be used as evidence for spoken claims. VTT captions are rolling, pause-based captions and may contain duplicates or recognition errors. Preserve both raw variants, then choose and normalise one explicitly; never treat a caption as a verified quote without checking the source recording.

The YouTube timed-text URLs exposed by player metadata are provider internals and can expire or require session context. Do not build a direct timed-text scraper as the primary ingestion path. yt-dlp remains the adapter boundary, with the exact video and channel checks above. A missing, blocked, or changed caption track is a partial source failure, not permission to download or infer a replacement transcript.

The index, archive-graph, and semantic-graph builders expect the episode directory to have a sibling `raw/` directory containing matching `<id>.info.json` metadata. The topic-graph builder takes one episode JSON file. The semantic graph builder also requires `OPENAI_API_KEY`.

## Normal pipeline

```text
catalogue official episode
  -> classify long-form episode
  -> record video ID and publish date
  -> obtain authorised source or approved captions
  -> preserve raw transcript
  -> normalise words and segments
  -> store transcript version
  -> create embeddings
  -> extract topics, claims, hooks, and moments
  -> mark transcript-only or renderable
```

## Quality checks per episode

1. Episode ID and title match the source.
2. Publish date is on or after 2023-03-01.
3. Transcript has non-zero word count.
4. Segment timestamps are monotonic and within episode duration.
5. A sample of five quotes opens at the right YouTube moment.
6. Proper names and speaker labels are marked uncertain until reviewed.
7. Source-file time and YouTube time are recorded separately when they differ.
8. The episode cannot become `renderable` without an approved private media asset.

## Evidence rule

The LLM may summarise retrieved transcript text. It may not invent a claim, speaker, quote, episode, or timestamp. The server must verify each returned verbatim quote against the cited transcript window before showing it.

Unsupported result:

> I couldn't verify that in the indexed archive.

That is a successful safe result, not a system error.
