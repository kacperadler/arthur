# AR0450 - Outcome

- Merged: 2026-10-26, `9eb39d8b`
- Branch: arthur/2026-10-26-worker-79f8fb55
- Reviews: review-1.md PASS
- Cost: worker $6.04, reviews n/a; review rounds 1

## What went in

- `README.md`: 115 lines (was 355): what Arthur is and is not, status, one line per package linking its docs, a 25-line Mermaid diagram of the core and plugin groups (AR-D87) with the full diagram by link, how to try it, read more, licence.
- `docs/setup.md`, `docs/deploy.md`, `docs/plugin-api.md`: brought up to today's merges (doctor's checks, installs and merge checks in their scope and sandbox, take-main, outside text as data, the provided-names table).
- `arthur.mmd`: the config node no longer shows the env file beside `arthur.config.ts`; dates 2026-10-26.
- `test/structure.test.ts`: the README-copy diagram test is replaced by one that holds the README at 120 lines with one small `flowchart` block (at most 40 lines).

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1111/1177 passed.

## Left open

- None: F1 fixed; F2 and F3 dropped (see findings.md).
- `npm test` on main counted 1111/1177: since AR0449 the merge runs the suite in the sandbox, where the tests needing a user manager or a Unix socket skip; GitHub CI runs them all.
