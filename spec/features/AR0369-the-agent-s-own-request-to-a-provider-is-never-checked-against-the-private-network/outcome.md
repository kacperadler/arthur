# AR0369 - Outcome

- Merged: 2026-11-02, `03a3298c`
- Branch: arthur/2026-11-02-worker-e17d4c76
- Reviews: review-1.md FAIL, review-2.md PASS
- Cost: worker $1.60, reviews $0.50; review rounds 2

## What went in

- packages/models/src/models.ts: the prepare looks up a provider model's host once more right before the agent starts, and refuses the job (`provider <name>: <host> resolves to <address>, not a private address`) when any address is not private.
- packages/models/test/models.test.ts: a test where the name turns public after the pick's probe and before the spawn's prepare, both as a single public address and as a public address after a private one. Each spawn is refused naming `8.8.8.8`, with no record, no worktree and no agent start.
- packages/models/docs/models.md: the Providers section states the lookup in the prepare at spawn and continue, and that the agent's own requests look the name up again unchecked, so giving a provider by address is the stricter choice.
- spec/roadmap.md: entry 82's "Delivers" lists the lookup in the prepare alongside load and each probe.
- test/structure.test.ts: the models package's line budget is 537 (was 534).

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1422/1493 passed.

## Left open

- Deferred (client summary): F1. a failed lookup in the prepare is untested
