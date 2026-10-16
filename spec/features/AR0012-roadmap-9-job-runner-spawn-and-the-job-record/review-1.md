# AR0012 - Review 1

- Job: 2026-10-16-review-ar0012-job-runner-9a3d61e1
- Branch: h/2026-10-16-ar0012-job-runner-spawn-b046ca2a
- Commit reviewed: 305a7a18cd53856e00284c2d196008c6939fece9
- Verdict: PASS

## Final message

Reviewed branch `h/2026-10-16-ar0012-job-runner-spawn-b046ca2a` at `305a7a1` against `spec/roadmap.md` entry 9, its ticket, and the Focus list.

**Verification performed**

- `npm ci`, `npm run check`, `npm test`: all pass, 135/135 tests, matching worker's claim exactly.
- Read `jobs.ts`, `git.ts` in full, plus the shared-file diffs (`host.ts`, `plugin.ts`, `testing.ts`, `cli.ts`) and all new tests (`jobs.test.ts`, `spawn.test.ts`, `testing.test.ts` addition, `cli.test.ts` diff).
- Mutation-tested five key behaviors directly in `packages/core/src/jobs.ts` (restored via `git checkout --` after each, confirmed clean with `git status --short` and a final green `npm test`):
  - Disabled the lockfile-equality check → `node_modules is copied when the lockfile is the same...` failed as expected.
  - Disabled the id/branch/worktree/record collision guard → `a branch, worktree or record that exists already...` failed with Git's own "branch already exists" error.
  - Disabled the `Ticket:` missing-file refusal → `every Ticket: file the task names must be in HEAD...` failed (missing rejection).
  - Forced a branch even for `readOnly` kinds → `a read-only kind gets a detached checkout...` failed (branch present where none expected).
  - Removed the catch-block cleanup on a throwing `prepare` → `prepare runs after the worktree and the record exist...` failed (`nothingMade` saw a leftover record).
  - Each mutation was caught by an existing test; no gap found.
- Confirmed `home` resolves to `.arthur/` (config.ts default, unmodified by this diff), so the record lands at `.arthur/jobs/<id>/` per roadmap entry 9, and worktrees at `.arthur-worktrees/<id>` beside the repo per the ticket's Decision — both match the worker's description.
- Confirmed boundaries: no `package.json`/exports changes (no new runtime dep, no new `@arthur/core` subpath export), `host.ts`/`plugin.ts`/`testing.ts`/`cli.ts` diffs are narrowly scoped to wiring `jobs`/`spawn`, nothing AR0020-shaped leaks in. `jobs.ts` (186 lines) and `git.ts` (48 lines) are both core-internal, under the 200-line cap and the core's 4000-line budget; no `class`/`enum`/`index.ts`/`types.ts`/`utils.ts`.
- Tests use `temporaryFolder()`-backed real Git repos per test, never the real `.arthur-worktrees` beside the actual checkout; `spawn.test.ts` spawns three real `arthur spawn` child processes concurrently and the fake-host test in `testing.test.ts` spawns on its own temp repo too.
- `README.md`/`docs/deploy.md` updates read accurately against before/after diff; `arthur.config.example.ts` correctly untouched (no new option added); `packages/core/docs/commands/spawn.md` matches the implemented refusals and fields.
- `removeWorktree`'s use of `git worktree remove --force` / `git branch -D` is the only call site, invoked solely to roll back a job the very same `spawn` call just created (zero commits beyond HEAD on the branch, at most a `prepare`-written uncommitted file) — bounded by the ticket's own required "a prepare that throws removes the worktree and the record" behavior and exercised by a test; not a loss of real owner work.
- F1 (branch literally named `arthur` collides with `arthur/<id>` ref namespace) is correctly filed `open` in `findings.md`, reproduced, confirmed nothing is left behind; it's outside the roadmap entry's listed Done-means edge cases (only exact-id collision is required), so leaving it open is acceptable, not a blocking gap.

**Notes (non-blocking)**

- F1 is a real Git ref-namespace limitation; worth a follow-up ticket, already flagged as such by the worker.

No requirement from entry 9's Done means, the ticket's Decisions, or the Focus list is missing, stubbed, or only claimed without evidence.

PASS
