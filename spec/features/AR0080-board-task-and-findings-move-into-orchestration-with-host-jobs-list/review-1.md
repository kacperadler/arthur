# AR0080 - Review 1

- Job: 2026-10-17-review-ar0080-28c774c1
- Branch: h/2026-10-17-ar0080-27036b90
- Commit reviewed: 33793d9e8bd53d215b63b2677058d02c66e2c746
- Verdict: PASS

## Final message

Clean tree, no leftover mutations.

---

**Findings:** none that block merge.

**Notes:**
- Final-message claim of 354/355 with a flaky `wrapper.test.ts` failure did not reproduce here (355/355 pass in this worktree); consistent with the worker's own characterization of it as a timing-dependent, pre-existing flake unrelated to this diff, and it is tracked as F1 in the ticket's `findings.md` rather than silently ignored.

**Checks run (in this worktree, on commit `33793d9`):**
- `npm ci` — clean install, 7 packages.
- `npm run check` (`tsc`) — passes, no errors.
- `npm test` — 355/355 pass.
- `node --test test/structure.test.ts` — all 13 structure checks pass; budgets (`core: 4713`, `orchestration: 398`) hold against actual usage.
- Manual repro: `arthur board` with an unloadable config prints `arthur: unknown command board`, the core's command list, and the load error, exit 2 — matches final message and the moved doc pages verbatim.
- Mutation checks (each applied, tested, then `git checkout --` to restore):
  - Removed `for (const command of boardCommands(host)) host.commands.register(command);` in `orchestration.ts` → multiple board/task/findings tests fail (confirms registration is covered).
  - Changed `inRun` to drop the `hold !== ""` clause in `job-state.ts` → `host.jobs.list(): ... running() is the ids of those in a run` test fails exactly on the held job (`...e`), confirming `running()`'s hold-inclusion is tested.
  - Changed `tickets: taskTickets(read("task"))` to `tickets: []` in `job-records.ts` → `/findings: the newest unmerged branch...` test fails, confirming the `tickets` field on `JobRecord` is load-bearing and tested.
- Boundary check: `packages/orchestration/src/board-commands.ts` imports only `@arthur/core/plugin`'s `Host` type; reads `host.board.full()`/`digest()`/`projects()`/`get()` and `host.jobs.list()`, never a core file by path or `boardText` directly — matches the claim and the styleguide's plugin boundary.
- Ticket Decisions (2026-10-17) explicitly accept both side effects the worker names (unknown-command exit 2, and the `cli.test.ts` edits) — diff matches those decisions exactly, and the review's Focus instruction to check them is satisfied.
- `host.jobs.list()`/`running()` relationship: `running()` is a pure filter (`records().filter(inRun).map(...)`) of `list()`'s output, satisfying the Done-means point and F2 of AR0094; `docs/commands/jobs.md` documents both.
- Old `packages/core/src/board-commands.ts` fully removed (clean cutover, no stray re-export); new file sizes (95–102 lines in orchestration) stay well under the 200-line cap.

PASS
