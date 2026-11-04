# AR0619 - Outcome

- Merged: 2026-11-04, `c9f19211`
- Branch: arthur/2026-11-04-worker-05ae6245
- Reviews: review-1.md FAIL, review-2.md PASS, review-3.md PASS
- Cost: worker $3.87, reviews $1.04; review rounds 3

## What went in

- packages/github/src/github-branch.ts: a delete that fails with git's own error, or a `[remote rejected]` with a 5xx reason, is recorded in `pending/<job id>`, told once, retried by `retry()` each poll, and given up with one notice after 24 h. A refusal a retry cannot change is one notice and drops the record. The checkout's config is checked before origin is contacted.
- packages/github/src/github.ts: provides `jobs.keep` from `pruned(...).keep` and calls `retry()` at the start of each poll.
- packages/github/test/github-branch.test.ts: the test world gets its own `~/.gitconfig`, with gates on origin's upload-pack and receive-pack that can fail or move a ref, plus a `reject(reason)` hook on origin. It polls each second once started. The tests cover:
- packages/github/docs/github.md: "Branches on origin" describes the AR0619 retry, its record, its notices and the 24 h limit.
- packages/discord/test/menu.test.ts: the READY menu test waits until `commands.json` holds the rewritten record before stopping the plugin and asserting its key.
- test/structure.test.ts: github line budget raised from 1020 to 1076.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1458/1529 passed.

## Left open

- Findings: none; no findings.md on this ticket.
