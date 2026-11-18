# AR0725 - Outcome

- Merged: 2026-11-18, `6deec255`
- Branch: arthur/2026-11-18-worker-4dce6d1a
- Reviews: review-1.md PASS
- Cost: worker $4.88, reviews $0.35; review rounds 1

## What went in

- packages/core/src/git.ts: `topLevel` and `head` each make one `git rev-parse` and read its status and output (`head` without `--quiet`); in a traced `npm test`, git processes fall from 39,486 (`c9e5f22a`) to 33,957 (`74aba610`), `rev-parse` from 13,784 to 10,502, traced git CPU from 124.0 s to 96.9 s.
- packages/core/src/test-env.ts: the kit's git config sets `maintenance.auto = false`; `git maintenance` processes in a traced `npm test` fall from 2,363 to 109.
- packages/core/test/git.test.ts: new; `topLevel` and `head` answers (inside and outside Git, a missing folder, no commit yet, a tag, a short id, names that are no commit, a range, a replacement not read), and that each starts git once with the hardened options.
- packages/core/test/testing.test.ts: the kit's identity test also checks that a commit under the kit starts no `git maintenance`, and that one with `maintenance.auto=true` does.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1844/1915 passed.

## Left open

- Findings: none; no findings.md on this ticket.
