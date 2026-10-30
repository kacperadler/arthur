# AR0577 - Outcome

- Merged: 2026-10-30, `4b974151`
- Branch: arthur/2026-10-30-worker-86e8884e
- Reviews: review-1.md PASS
- Cost: worker $2.44, reviews $0.48; review rounds 1

## What went in

- `packages/core/src/test-env.ts` (new): imported first by the kit; clears the `ARTHUR_*` and tmux variables, sets `HOME`, `TMPDIR` and `GIT_CONFIG_GLOBAL` (user `test`, `test@example.com`) under the kit's root, and on SIGTERM, SIGINT or SIGHUP exits so the kit's cleanup runs, unless the code under test handles that signal itself.
- `packages/core/src/testing.ts`: imports it; temporary folders are made in `<root>/tmp`, where a job's sandbox lets its tests write.
- `packages/core/test/testing.test.ts`: the variables set, the identity, and a signalled child that leaves no root (and no slice where a systemd user manager runs).
- `test/structure.ts`, `test/structure.test.ts`: `test-env.ts` counts as the test kit; its budget 351 to 357 (AR-D355).

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1254/1335 passed.

## Left open

- Deferred (client summary): F1. That a signalled child leaves no slice is unproven.
- Deferred (client summary): F2. GIT_AUTHOR_*, GIT_COMMITTER_* and EMAIL in the caller's environment still win over the kit's identity.
