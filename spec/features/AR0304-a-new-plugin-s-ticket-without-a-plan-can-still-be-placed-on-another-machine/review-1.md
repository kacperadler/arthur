# AR0304 - Review 1

- Job: 2026-10-22-review-ar0304-6ffb6564
- Branch: h/2026-10-22-ar0304-a4b43aeb
- Commit reviewed: 30eea3c2b1f9a5a52f4319fefcd836054794d425
- Verdict: PASS

## Final message

Branch implements ticket's chosen option cleanly: `need()` in `machine-place.ts` reads `machine` from the ticket's JSON block alongside `requires`, treats it like `--machine` (checked for labels, not checked online, `maxJobs` ignored, `--machine` wins), validates it's a non-empty string, and reads it even when `--requires` replaces labels (fixing the "ticket not read in that case" staleness). `develop` adds the coordinator-context line only for projects that are Arthur's repository, and updates the worker's "wrong machine" message to point at the ticket's JSON field instead of a literal respawn command. Docs (`machines.md`, `plugin.md`, `develop.md`, `spawn.md`, `coordinator.md`) and the `structure.test.ts` budget comment are updated consistently; `main`'s copy of the ticket already carries the 2026-10-23 Decisions entry for the budget raise the worker flagged as pending, so that's resolved on `main` as the review guide requires reading it.

Verification performed in this worktree:
- `npm ci`: 22 packages, clean.
- `npm run check`: exit 0, no tsc errors.
- `npm test`: 1041/1041 pass, matching the worker's claim.
- `cat packages/{machines,develop}/src/*.ts | wc -l` → 479 / 681, matching the budget raise and the worker's claim.
- `describe` import in `machine-place.ts` resolves to `@arthur/core`'s published export (`config.ts`), not a path into core internals — boundary respected; the import line itself predates this diff.
- Mutation testing (applied then reverted with `git checkout --`/restore, tree clean after):
  - Drop ticket pin (`asked.machine ?? machine` → `asked.machine`): caught by the new machines test (`'mac' !== 'local'`).
  - Invert the ", which its ticket names," wording condition: caught (message mismatch in the labels-refusal test).
  - Remove the `machine` string/blank validation: caught (`Missing expected rejection: 5`).
  - Remove the "is Arthur's repository" filter in `pluginNewContext`: caught (`other` project wrongly appears in context line).
  All four mutations of the branch's key new logic are caught by its own tests; no gap found.

Notes (non-blocking):
- Worker left `plan-ended.md`/the planner's `--machine local` instruction unchanged, with a stated rationale (still works, ticket's `machine` does the same job) — reasonable, not required by the ticket.

No finding rises to a FAIL: logic, tests, docs, budgets, boundaries and checks all line up with the ticket and the worker's final message.

PASS
