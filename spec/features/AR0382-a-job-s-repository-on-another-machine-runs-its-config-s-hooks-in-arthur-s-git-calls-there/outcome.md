# AR0382 - Outcome

- Merged: 2026-10-25, `559c77e0`
- Branch: h/2026-10-24-ar0382-remote-hooks-4f172ca4
- Reviews: review-1.md PASS
- Cost: worker $2.41, reviews $0.57; review rounds 1

## What went in

- `packages/core/src/remote-job.ts`: the `git` helper there (`init`, `worktree remove`, `worktree prune`) and the prune's `update-ref -d` pass `-c core.hooksPath=/dev/null -c core.fsmonitor=false`, so the repository on the other machine runs no hook or fsmonitor of its own.
- `packages/core/src/job-machine.ts` (`reach`): the spawn's push sends `--receive-pack=git -c core.hooksPath=/dev/null receive-pack`, so no receive hook runs there.
- `packages/core/test/machine.test.ts`: a test that plants hooks and an fsmonitor there, spawns, prunes, sees nothing run, and sees a plain `git worktree add` run them; push-count filters match `receive-pack`.
- `docs/deploy.md`, `docs/commands/remote-job.md`: one sentence each. `test/structure.test.ts`: core budget 6021 (Decision in the ticket).

## Checks on main

- `npm run check`: passed.
- `npm test`: 1087/1087 passed.
- CI ci: passed https://github.com/kacperadler/arthur/actions/runs/40144232302

## Left open

- Tickets from findings: AR0394 (F1).
