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

## Judge model validation (2026-09-18) and switch to gpt-6-astra-max

Batch: the 5 known viral hits + 12 seed-42 random control windows, each model
run twice. Hits are windows 1-5.

| model | hits run1 | hits run2 | randoms max | randoms median |
|---|---|---|---|---|
| claude-sonnet-5-medium (old default) | 8,8,7,6,8 | 8,9,7,6,8 | 7 / 8 | 4.5 / 5.0 |
| gpt-6-astra-max | 9,8,7,6,9 | 8,8,6,5,9 | 8 / 7 | 1.5 / 1.5 |
| claude-fable-5-1-max | 9,8,8,5,8 | 9,8,7,5,8 | 8 / 8 | 2.0 / 3.0 |

Strict margin gate (min hit score >= max random + 1) fails for ALL THREE
models, driven by the same two intrinsically ambiguous windows: hit #4
("receipts", PyhmvAL-iYw 3850-3960) scores 5-6 on every model, and random #11
("cancer rant", kBm8Ho-_RXM@4179) scores 6-8 on every model. The incumbent
sonnet fails the same gate.

On population separation astra > fable > sonnet: astra compresses randoms to
median 1.5 (10 of 12 randoms below the minimum hit score in both runs) while
keeping hits at 5-9; sonnet inflates randoms to median ~4.75.

Default switched to gpt-6-astra-max ($10/$50 per 1M, same list price as
fable; user preference listed astra first). To revert:
`git revert` the switch commit, or change --model back to claude-sonnet-5-medium.
