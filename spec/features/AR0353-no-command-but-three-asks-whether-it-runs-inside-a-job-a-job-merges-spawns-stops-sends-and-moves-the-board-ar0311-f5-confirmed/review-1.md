# AR0353 - Review 1

- Job: 2026-10-23-review-ar0353-job-runs-h-7103e464
- Branch: h/2026-10-23-ar0353-job-runs-h-comman-77582826
- Commit reviewed: 077fd7a383eb11016040a84a91bb624319e03253
- Verdict: PASS

## Final message

Worktree clean, all mutated files restored.

## Review Summary

**Scope match**: Ticket's Done means asks for one gate in `cli.ts` beside `ARTHUR_EVAL`'s, a `Command.inJob` field, and a specific enumerated list of `inJob: true` commands (help, version, jobs, decisions, board, task, plan, findings, projects, machines, resources, roles, stats, retro-due, health, schedule-list, youtrack, plugin, remote-job-records). Diff implements exactly this list — verified every `inJob: true` addition against the ticket's named command, no extras, no omissions.

**Ticket departure (gate placement)**: ticket text says refuse "before the config loads"; gate actually runs after `load()` (plugins set up). `main`'s current ticket copy already carries a Decisions line accepting this placement verbatim ("accepted in place of 'before the config loads' ... no state changes before it; tested") — this is not an unresolved departure, it's already ratified.

**Line-budget raises**: `main`'s ticket Decisions already lists the exact raised numbers the worker requested (core 5889, schedule 594, manage 928, orchestration 2319, develop 705, findings 255, machines 488, projects 486, resources 617). Verified by `wc -l` against `packages/*/src` (core minus the `core/testing` kit lines = 5889 exactly); all others match exactly.

**Mutation testing** (each applied in this worktree, tests run, then reverted — tree confirmed clean after):
- `cli.ts` gate deleted (`if (false)`) → caught by `cli.test.ts`.
- `command.inJob !== true` inverted to `=== true` → caught by `cli.test.ts` and `job-gate.test.ts`.
- `job !== ""` guard dropped (always-refuse) → caught by both (empty-`ARTHUR_JOB` "same command acts" assertion failed as expected).
- `commands.ts` registration check for bad `inJob` removed → caught by `commands.test.ts`.
- `remote-job.ts`'s `step !== "records"` gate removed → caught (would have actually executed "no such job" path, proving state-changing commands reach their real logic without the gate).
- `schedule-command.ts`'s `verb !== "list"` gate removed → caught (would have actually written `spec/schedule.json`, confirming the gate is what prevents the state change).

**Verification run**: `npm ci` clean; `npm run check` (tsc) clean; `npm test` → 1065/1065 pass, matching the worker's claimed count exactly, including the new `test/job-gate.test.ts` (34 refused lines, 23 allowed lines, folder-unchanged assertion) which I confirmed passes for real, not just by the worker's say-so.

**Docs**: `help.md`, `worker.md`, `deploy.md`, `plugin-api.md`, `remote-job.md`, `schedule.md` all updated consistent with the new behavior; cross-checked wording against the actual refusal string in code — matches.

**Findings**: F1 (help.md's stale 9-of-17 core-command list) and F2 (read-only `ci`/`config check`/`doctor`/`retro`/`usage` refused too) are correctly filed as `open` findings rather than silently expanded scope — consistent with the ticket's literal enumerated list, which does not name these commands as `inJob`.

**Boundary/styleguide check**: no plugin imports another plugin; no core-internal path imports; no new runtime deps; no classes/enums; `structure.test.ts` ("the repository keeps every rule") passes, confirming line budgets and plugin isolation rules hold.

No findings that block merge.

Notes (non-blocking):
- `decision.ts`'s own pre-existing `ARTHUR_JOB` check is now dead code (cli.ts's gate refuses `decision` before `run()` is ever called, since it carries no `inJob`); harmless but worth a cleanup note for a future ticket, not required here.

PASS
