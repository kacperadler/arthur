# AR0687 - Outcome

- Merged: 2026-11-11, `2b7199c3`
- Branch: arthur/2026-11-11-worker-bd554130
- Reviews: review-1.md PASS, review-2.md PASS
- Cost: worker $9.69, reviews $1.52; review rounds 2

## What went in

- `docs/deploy.md`: the threat model says a job reads its own folder of each plugin extension (its recorded checks), and no other plugin state.
- `packages/core/docs/commands/spawn.md`: "The sandbox" says the home shows the job's own folder of each registered extension (AR0687) and its docker script folder once made (AR-D597).
- `packages/core/roles/worker.md`: new line saying check, test and mutate run last on the committed tip, nothing is committed after them, and a later commit needs them again.
- `packages/core/src/job-sandbox.ts`: `hidden()` shows `<home>/<package>/<id>` for each extension in the record's `extensions` file, the same folders `writable()` grants, beside main's `docker/jobs/<id>`.
- `packages/core/test/sandbox.test.ts`: the AR0590 `hidden()` test also checks that a record's `extensions` shows its own delivery folder and nothing else.
- `packages/delivery/src/checks-extension.ts`: when the checks ran on another commit, the reminder names that commit and the current tip, and says any commit after them needs them run again.
- `packages/delivery/test/checks.test.ts`: pins the full reminder for a commit after the checks; the helper that pulls out the missing checks allows the new sentence.
- `spec/features/AR0687-workers-commit-after-their-checks-ran-so-every-review-is-refused-until-a-second/findings.md`: new file with F1 (extension errors in a sandbox go unseen).
- `test/job-home.test.ts`: the sandboxed job writes and then reads its own `delivery/<id>/checks`, and the test expects that read to succeed.
- `test/structure.test.ts`: core's line budget goes from 7528 to 7529 and delivery's from 2243 to 2246, measured.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1661/1732 passed.

## Left open

- Deferred (client summary): F1. An extension that throws in a job's sandbox fails silently, so a broken reminder ships green
- Deferred (client summary): F2. the folders `hidden()` shows come from the record's `extensions` file, which the job's sandbox lets it write
