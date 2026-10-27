# AR0516 - Outcome

- Merged: 2026-10-27, `b2b1c1e4`
- Branch: arthur/2026-10-27-worker-9da5d0ff
- Reviews: review-1.md PASS
- Cost: worker $2.81, reviews $1.85; review rounds 1

## What went in

- `packages/core/src/job-sandbox.ts`: `unsigned(env)` adds `commit.gpgSign=false` and `tag.gpgSign=false` after any `GIT_CONFIG_*` entries already given; the install and every merge step get them.
- `packages/core/src/wrapper.ts`: the agent's environment gets them too, so a job commits and tags unsigned with no flag; Arthur's own merge commit, made outside the sandbox, keeps the owner's signing.
- `packages/core/test/sandbox.test.ts`: over a temporary home that signs with a key under `.ssh`, the install, the agent and a merge step commit and tag unsigned, and the owner's own `GIT_CONFIG_*` entry stays.
- `packages/core/docs/commands/spawn.md`, `docs/deploy.md`: say a job's commits and tags are unsigned and the merge commit is signed as the owner's Git config says.
- Merged with signing off in the merge's environment once (AR-D188), so the merge commit itself is unsigned.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1142/1209 passed.

## Left open

- Findings: none; no findings.md on this ticket.
- Tickets from findings: AR0519 (F7).
