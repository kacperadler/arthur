# AR0093 - Findings

## F1. The runner's prune checks `ids.length === 0` on a type that may be `"all"`

- Kind: cleanup
- Found by: 2026-10-17-review-ar0093-494f7e41 (review), 2026-10-17
- Where: `packages/core/src/job-records.ts` (`prune`)
- What: the empty-list check reads `.length` of a `string[] | "all"`; it is right only because `"all"` is not empty.
- Suggestion: check `ids === "all"` first.
- Status: dropped (correct as written, `"all"` is checked separately; style only)
