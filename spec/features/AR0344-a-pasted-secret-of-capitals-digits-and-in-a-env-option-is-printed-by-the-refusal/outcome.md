# AR0344 - Outcome

- Merged: 2026-10-25, `432245c4`
- Branch: arthur/2026-10-25-worker-26e85465
- Reviews: review-1.md FAIL, review-2.md PASS
- Cost: worker $0.72, reviews n/a; review rounds 2

## What went in

- `packages/core/src/env.ts`: a refused `...Env` value is printed only when it is a variable name starting with `ARTHUR_` (a name of the wrong plugin or instance); any other value gets `the text given is not shown`.
- `packages/core/test/env.test.ts`: `DEADBEEF0123`, `YOUTRACK_TOKEN`, `ARTHUR_YOUTRACK_ghp-secret` and `ARTHURTOKEN123` are refused without being shown; wrong `ARTHUR_` names are still named.
- `packages/core/docs/commands/config.md`: says a value not starting with `ARTHUR_` is not shown.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1108/1108 passed.

## Left open

- Findings: F1-F3, review notes, dropped (see findings.md).
