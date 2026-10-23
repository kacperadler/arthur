# AR0309 - Outcome

- Merged: 2026-10-23, `dc3a23c`
- Branch: h/2026-10-23-ar0309-ci-git-identity-98a66810
- Reviews: review-1.md PASS
- Cost: worker $1.11, reviews $0.50; review rounds 1

## What went in

- `packages/delivery/test/auto-merge.test.ts`, `test/ci-wait-wake.test.ts`: each temporary repository gets its own `user.name`/`user.email` right after `git init`, so `arthur merge` inside them works on a machine with no global git identity (GitHub's runner); the full suite passes with an empty `HOME` and `GIT_CONFIG_NOSYSTEM=1`. GitHub's `ci` workflow is green again (run 39946119163), red on main since 907c613.
- `.agents/harness/project.json`: `"ci": "ci"`, so the harness waits for this repository's GitHub `ci` run instead of a `macOS` one Arthur does not have.

## Checks on main

- `npm run check`: passed.
- `npm test`: 1047/1047 passed.
- CI macOS: none

## Left open

- Tickets from findings: AR0310 (F1).
