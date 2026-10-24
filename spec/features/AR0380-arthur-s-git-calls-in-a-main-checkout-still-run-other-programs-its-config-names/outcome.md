# AR0380 - Outcome

- Merged: 2026-10-25, `fa9078a5`
- Branch: h/2026-10-24-ar0380-git-config-progra-2bc459e3
- Reviews: review-1.md PASS
- Cost: worker $6.23, reviews $1.12; review rounds 1

## What went in

- `packages/core/src/git-config.ts` (new, exported as `@arthur/core/git-config`): `configRefusal(root)` reads the repository's `local` and `worktree` Git config (with includes) and refuses the first key outside an allowed set (what git init/clone, LFS, upstreams, submodules, push/fetch settings and Arthur write; `core.hooksPath` and `core.fsmonitor` pass, since every call overrides them), naming the file and key.
- `packages/core/src/git.ts` (`addWorktree`), `packages/core/src/job-machine.ts` (`gitOver`), `packages/delivery/src/merge-command.ts` (before any git call and again before the reset after a failed check), `packages/github/src/github-git.ts` (before the LFS and the real push): ask it first.
- Tests for each call site and for the check; the LFS alias case moved into the new push test.
- `docs/deploy.md` (threat model: the allowed set and its limits), `docs/plugin-api.md` (the new export), spawn/merge/github docs (the refusals). `test/structure.test.ts`: budgets core 5987, delivery 1317, github 651.

## Checks on main

- `npm run check`: passed.
- `npm test`: 1085/1085 passed.
- CI ci: passed https://github.com/kacperadler/arthur/actions/runs/40140542379

## Left open

- Tickets from findings: AR0392 (F1), AR0393 (F2).
