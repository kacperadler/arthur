# AR0394 - Outcome

- Merged: 2026-10-25, `d13732e2`
- Branch: h/2026-10-25-ar0394-remote-push-confi-a2787f57
- Reviews: review-1.md PASS
- Cost: worker $2.71, reviews $0.77; review rounds 1

## What went in

- `packages/core/src/remote-job.ts`: the `repo` step runs `configRefusal` on the bare repository there before any push and throws `no push: <file> sets <key>, …`, so the spawn is refused before a push or a record; `prune` runs `configRefusal` on the worktree there while it exists (a `git worktree remove` without `--force` runs status, and so a clean filter).
- `packages/core/src/job-machine.ts`: `reach` returns that refusal; its comment says so.
- `packages/core/test/machine.test.ts`: push refused with nothing run and no record, push after the key is unset, fetch back runs nothing; prune refused for a key in the shared config and in `config.worktree`, and a gone worktree still pruned.
- Docs: `remote-job.md`, `spawn.md`, `prune.md`, `docs/deploy.md` threat model. `test/structure.test.ts`: core 6081 (Decision in the ticket).

## Checks on main

- `npm run check`: passed.
- `npm test`: 1096/1096 passed.
- CI ci: passed https://github.com/kacperadler/arthur/actions/runs/40155044570

## Left open

- Tickets from findings: AR0400 (F1).
