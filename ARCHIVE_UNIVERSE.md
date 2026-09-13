# FlightStory Archive Universe

## Current system

The product is a private, citation-first knowledge system for the Diary of a CEO archive. It lets a researcher ask a question, find related ideas, inspect transcript evidence, and open the original YouTube moment.

Current graph inventory:

```text
1,000 topic nodes
241 video nodes
12,000 transcript-topic connections
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

Topic connections are generated separately from transcript co-occurrence. A topic is a repeated meaningful word found in transcript segments. A topic edge exists when two topics appear in the same transcript segment. Every source record retains the originating episode URL and timestamp.

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
