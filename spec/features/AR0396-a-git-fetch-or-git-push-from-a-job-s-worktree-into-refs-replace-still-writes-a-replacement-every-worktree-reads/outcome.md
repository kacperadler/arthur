# AR0396 - Outcome

- Merged: 2026-11-03, `cb5e5157`
- Branch: arthur/2026-11-02-worker-a6b72b8b
- Reviews: review-1.md PASS
- Cost: worker $3.99, reviews $0.61; review rounds 1

## What went in

- packages/core/src/git-writes.ts: `intoReplace` sets `replaces` for a fetch, pull, push or send-pack whose refspec words or `=` option values may write under `refs/replace`: any letter case, globs and brace lists, push refspecs without `:` or that Git completes with `refs/`, `--mirror`, and `--stdin`. Its comment names the limits.
- packages/core/src/bash-refusal.ts: the guard's header comment names the fetch and push refusal beside `git replace`.
- packages/core/test/worktree-guard.test.ts: 24 refused rows, 2 passing rows, and a check that the refusal text names the fetch.
- docs/deploy.md: the `refs/replace` paragraph lists what the guard now refuses and what it does not (run-time refspecs, config refspecs, refs another repository names).
- test/structure.test.ts: core line budget 7116 (was 7099).
- spec/features/AR0396-a-git-fetch-or-git-push-from-a-job-s-worktree-into-refs-replace-still-writes-a-replacement-every-worktree-reads/findings.md: F1 (config, other-repository and run-time refspecs), F2 (`git fast-import`), F3 (brace lists in paths), all open.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1423/1494 passed.

## Left open

- Deferred (client summary): F1. A refspec that config, another repository or the shell at run time defines still writes `refs/replace` past the guard
- Deferred (client summary): F2. `git fast-import` writes any ref, `refs/replace` and `refs/heads/main` included, and passes the guard
- Deferred (client summary): F3. The guard does not expand a brace list in a path: `rm ../../{acme,x}/README.md` passes
- Deferred (client summary): F4. Refspecs from config are not seen
- Deferred (client summary): F5. The guard lets `git fast-import` write any ref, `refs/replace` and `refs/heads/main` included
