# FlightStory Archive Universe

## Current system

The product is a private, citation-first knowledge system for the Diary of a CEO archive. It lets a researcher ask a question, find related ideas, inspect transcript evidence, and open the original YouTube moment.

Current graph inventory:

```text
90 concept nodes (recurring phrase-level concepts and an audited single-word concept vocabulary)
241 video nodes
1,696 transcript-concept connections
1,428 OpenAI semantic video links
235 distinct trusted source videos represented by selected node links
```

The 241 video nodes come from the current local transcript set after channel provenance validation. The topic graph applies an additional catalogue-title check and currently uses 234 transcript files. The catalogue contains more records than trusted transcripts; failed, ambiguous, mismatched, or non-DOAC YouTube matches are kept out of the trusted graph until they are repaired.

## Brain-inspired architecture

This is inspired by distributed activation and weighted connections. It is not a biological brain simulation.

```text
video transcript representation
        ↓
OpenAI embedding activation pattern
        ↓
cosine similarity
        ↓
weighted video-to-video connection
        ↓
Three.js visual edge
```

Each video is represented by its title plus evenly sampled timestamped transcript segments. OpenAI `text-embedding-3-small` turns that representation into a vector. Similar vectors create stronger links. The application stores the resulting graph as `public/video-links.json`.

Topic connections are generated separately from transcript co-occurrence. A concept is a recurring phrase or audited single-word idea found across transcript segments and at least two episodes; grammatical fragments and filler are excluded. A concept edge exists when two concepts appear in the same transcript segment or conversation archive. Every source record retains the originating episode URL and timestamp.

## Visual language

- pale nodes: transcript topics
- coloured nodes: video sources
- gold lines: semantic links between videos
- bright citation nodes: exact verified moments
- coloured cluster fields: topic families such as health, mind, money, culture and relationships
- moving link signals: active semantic connections
- fading links: low-current connections, so the graph feels alive without claiming that a biological neuron is being simulated

## Data and provenance

The transcription pipeline is resumable and uses public English auto-captions where available. YouTube title matching is checked against catalogue titles. Mismatched or ambiguous results are rejected rather than silently added.

Important limits:

- speaker labels are not complete;
- auto-captions can misspell names;
- semantic links indicate similarity, not agreement, causation or truth;
- the current graph is based on the validated local transcript set, not the entire catalogue;
- the live graph is a static generated artifact and must be regenerated after new transcripts arrive.

## Regeneration

From the project root:

```bash
node scripts/build_archive_graph.mjs
node --env-file-if-exists=.env.local scripts/build_semantic_video_graph.mjs
npm run build
npm run check
```

The first command rebuilds topic nodes and transcript co-occurrence edges. The second uses OpenAI embeddings to rebuild video-to-video links. The generated JSON files are then consumed by the Three.js universe.

## Product loop

```text
observe graph behaviour
        ↓
check source accuracy and interaction
        ↓
remove false / noisy connections
        ↓
add validated transcripts
        ↓
regenerate embeddings and visual graph
```

The next upgrade should add transcript chunk embeddings, speaker attribution, and an LLM-generated relationship label for the strongest video links. Those labels must always link back to the two source moments that support them.

## Ten-pass recursive quality review

Completed 13 September 2026:

1. Data integrity — passed: 1,000 topic nodes and 12,000 topic links.
2. Channel provenance — passed: the semantic graph uses channel-validated DOAC sources.
3. Source diversity — passed: 241 video nodes map to 241 source URLs.
4. Timestamp coverage — passed: every current video node has a non-zero transcript timestamp.
5. Semantic graph — passed: 1,428 OpenAI embedding links.
6. Topic graph — passed: 12,000 transcript co-occurrence links.
7. Source URL format — passed: video nodes use YouTube watch URLs.
8. Edge integrity — passed: every semantic edge resolves to two video nodes.
9. Build and syntax — passed: `npm run build` and `npm run check`.
10. Production parity — passed: production loads the graph, Three.js canvas, and no visible archive error.

The review also removed a source-collapsing bug, rejected non-DOAC search results, moved nodes away from the opening timestamp, reduced label collisions, and added pulsing links with moving signal particles. The next quality gate is relation-specific chunk timestamps: each semantic edge should eventually point to the exact two transcript chunks that produced it.

## 100-pass role review

The review system uses ten passes per role. Each pass follows `observe → hypothesis → one change → test → retain or revert`.

| Passes | Role | Focus |
|---:|---|---|
| 1–10 | Product manager | primary job, evidence contract, coverage states, success metric |
| 11–20 | Provenance engineer | canonical IDs, channel validation, source confidence, rejected-source queue |
| 21–30 | Transcription specialist | captions, timestamps, speaker states, caption uncertainty, transcript QA |
| 31–40 | Retrieval / LLM engineer | archive-wide retrieval, chunk evidence, citation validation, refusal states |
| 41–50 | Neuroscientist | distributed activation, weighted edges, decay, inhibition, avoid biological overclaiming |
| 51–60 | Graph analyst | concept quality, aliases, centrality, communities, noisy-edge control |
| 61–70 | Three.js developer | galaxy placement, visual encoding, animation state, performance budgets |
| 71–80 | UI / UX designer | selection, inspection, source actions, progressive detail, keyboard alternative |
| 81–90 | User advocate | research, clips, comms, commercial workflows, trust language, recovery from failure |
| 91–100 | Orchestrator / developer | integration order, tests, versioning, rollback, production parity, learning loop |

The first integrated cycle fixed archive-wide retrieval, source provenance, stale-search protection, node selection behaviour, source timestamps, cluster density, label collisions, and production verification. The remaining high-value work is relation-specific chunk evidence, speaker attribution, edge inspection, and durable team workspaces.
