# LLM re-scoring of heuristic-flagged moments

Pipeline used for the 2026-09-18 re-score (599 of 600 windows):

1. `node scripts/score_virality.mjs` — heuristic wide net (validated vs DOAC top shorts).
2. Extract full 60-80s window text for every window with heuristic score >= 5.
3. `scripts/llm_rescore_virality.sh <batchNNN>` — batches of 10 windows through
   `devin -p --respect-workspace-trust false --model claude-sonnet-5-medium`,
   same 6-criterion rubric as the heuristic. Model validated before use:
   4/5 known viral hits score 8-9, random-control median ~3.
4. Merge: llmScore replaces score when present; tiers TOP CLIP >= 8.5,
   STRONG 7-8.4, SOLID 5-6.9. Then `node scripts/bake_virality_public.mjs`.

Cost: ~60 batched calls, nominal list-price equivalent under $1, drawn from
the Devin Max plan's included weekly quota.
