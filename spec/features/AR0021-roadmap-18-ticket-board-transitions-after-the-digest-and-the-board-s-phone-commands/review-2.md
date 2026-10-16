# AR0021 - Review 2

- Job: 2026-10-16-review-ar0021-board-tran-cd130e90
- Branch: h/2026-10-16-ar0021-board-transitions-76954a78
- Commit reviewed: c9929f3dd62287ba4e749e188ff325774b018911
- Verdict: PASS

## Final message

Findings: none that block merge. All five conflicted files (README.md, cli.ts, host.ts, cli.test.ts, spawn.test.ts) correctly keep both sides — `follow` (AR0035) + ticket-move-on-job-started (AR0021) in host.ts/LoadedPlugins; `rolesCommand` (AR0013) + `ticketCommand`/`boardCommands` (AR0021) in cli.ts; combined command lists and the `after`/board/task/findings tests in cli.test.ts; `registerRole("reviewer")` + `projects` provider + ticket-status board.json + warning-line expectations in spawn.test.ts; combined status-line wording in README.md.

Notes (non-blocking):
- Worker disclosed an unverified double-report risk when `arthur run` also delivers `job-started` (AR0035 follow + AR0021 handler both firing); explicitly flagged as not run, findings F1–F3 unchanged. Acceptable disclosure, not required by this round's follow-up.

Checks run (in this worktree, on commit c9929f3):
- `npm ci`: clean, 5 packages, no errors.
- `npm run check` (tsc): no output, exit clean.
- `npm test`: 182 tests, 182 pass, 0 fail — matches worker's claim exactly.
- Test-count arithmetic verified independently by counting top-level `test(` per revision: aae3f35=156, f7e6d71=169, 550278e=169, c9929f3=182 → 156+13+13=182, matches worker's table and the actual run.
- Mutation 1: inverted `if (kind !== "worker") return;` to `=== "worker"` in `host.ts` (disables transition for workers, enables it for read-only kinds) → caught: "a worker's start moves its ticket to in-progress…" fails (181 pass/1 fail). Reverted via `git checkout -- packages/core/src/host.ts`.
- Mutation 2: changed the move's target status from `"in-progress"` to `"planning"` in the same handler → caught by the same test. Reverted; `git status --short` clean afterward.
- Confirmed every test that spawns a read-only kind (`jobs.test.ts`, `roles.test.ts`, `testing.test.ts`, `spawn.test.ts`) also calls `registerRole` for that kind's role.
- Confirmed via code read (`events.ts:110-111`, `jobs.ts:140`, `cli.ts:123-124`) that the refusal line printing before the spawn warning in the merged `spawn.test.ts` expectation matches actual emit order (sync handler failure logged inside `bus.emit`, called before `jobs.spawn` returns to the CLI's warning loop).

PASS
