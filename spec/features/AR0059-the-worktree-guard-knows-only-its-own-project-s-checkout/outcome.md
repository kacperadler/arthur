# AR0059 - Outcome

- Merged: 2026-10-17, `0177255`
- Branch: h/2026-10-17-ar0059-739ce1fb
- Reviews: review-1.md PASS
- Cost: worker $1.57, reviews $0.47; review rounds 1

## What went in

- `packages/core/src/worktree-guard.ts`: a job's write into another declared project's main checkout or its job worktrees is refused, naming that project; the refusal picks the innermost guarded folder.
- `packages/core/src/job-checkout.ts`: `checkouts` lists every declared project's checkout.
- `packages/core/src/job-record.ts`, `jobs.ts`: the record's new `projects` key, filled at spawn; `remote-job.ts` writes it empty, since another machine's repositories lie in the guarded home folder.
- `spawn.md`, `docs/deploy.md`: the key and the wider guard.

## Checks on main

- `npm run check`: passed.
- `npm test`: 332/332 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- F1: ticket AR0092 (planning). F2: dropped.
