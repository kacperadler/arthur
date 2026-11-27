# AR0749 - Outcome

- Merged: 2026-11-27, `ef28f150`
- Branch: arthur/2026-11-27-worker-50c2002d
- Reviews: review-1.md PASS
- Cost: worker $1.35, reviews $0.35; review rounds 1

## What went in

- `packages/projects/src/projects.ts`: each load outside a job writes `checkouts`, `folders` and the new `prefixes` (`<name> <prefix>` per project) through `keep`, rewritten whole and only when changed.
- `packages/core/src/job-sandbox.ts`: `hidden()` shows `<home>/projects/prefixes` to every job, next to `checkouts` and `folders`; the comment names it.
- `packages/projects/test/projects.test.ts`: the load test asserts the `prefixes` content, the unchanged inode, the file kept after a refused reload, and that bad prefixes are never written.
- `packages/core/test/sandbox.test.ts`: the `hidden()` rows include `prefixes`; the real Landlock test reads `prefixes` in a job while shop2's `project.config.ts` stays denied.
- `packages/projects/docs/commands/projects.md`: names `<home>/projects/prefixes`, what a refused load does to it, that a job's sandbox shows it, and that a job leaves it alone.
- `packages/core/docs/commands/spawn.md`: "The sandbox" lists `prefixes` among what a job reads in the home, while other projects' folders and `project.config.ts` stay hidden.
- `docs/deploy.md`: the threat model's "Still readable to it" names every project's ticket prefix (`<home>/projects/prefixes`).

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1908/1980 passed.

## Left open

- Deferred (client summary): F1. a running job only sees `prefixes` as it was when its run started
