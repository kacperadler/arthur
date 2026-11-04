# AR0615 - Outcome

- Merged: 2026-11-04, `b652a7f5`
- Branch: arthur/2026-11-04-worker-0d510c16
- Reviews: review-1.md FAIL, review-2.md PASS
- Cost: worker $2.52, reviews $1.09; review rounds 2

## What went in

- packages/core/src/git-config.ts: allows `core.usereplacerefs`, and `checkConfig` sets `core.useReplaceRefs=false` again in a repository's own config whenever the last value there is not `false`; a failed write in a repository refuses the call.
- packages/core/src/git-writes.ts: the comment on `intoReplace` names `core.useReplaceRefs=false` instead of the open limit.
- packages/core/test/git-config.test.ts: the finding's mirror push into the main checkout is read past; the setting comes back after each way a job turns it back on (`true`, `yes`, `on`, `1`, `2`, `True`, a key with no value, the main checkout's `config.worktree`, the shared config checked from a job's worktree); a failed write is refused.
- packages/commit-rules/test/commit-rules.test.ts: its test repository already has `core.useReplaceRefs=false`, so its "config untouched" and "install fails" tests see only the plugin's own change.
- docs/deploy.md: lists `usereplacerefs` in the allowed keys and says replacements from refspecs the guard does not see are read past because the setting is kept.
- test/structure.test.ts: core line budget 7158 → 7163.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1465/1536 passed.

## Left open

- Deferred (client summary): F1. the setting is only put back when `checkConfig` runs, not passed to the git call
