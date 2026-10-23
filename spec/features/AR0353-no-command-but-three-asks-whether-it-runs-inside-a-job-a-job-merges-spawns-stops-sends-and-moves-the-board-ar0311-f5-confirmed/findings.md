# AR0353 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

`- Budget:` is optional: set it, in USD, only when the ticket this finding becomes is expected to cost more than the autopilot default, and leave the line out otherwise. `h merge` copies it into the ticket's JSON block as `budget`, which `h ticket status --autopilot` passes to `--budget`, capped at `H_AUTOPILOT_BUDGET_MAX`.

## F1. `arthur help --help` names nine of the core's seventeen commands as the ones left when the config does not load

- Kind: cleanup
- Found by: 2026-10-23-ar0353-job-runs-h-comman-77582826 (worker), 2026-10-23
- Where: `packages/core/docs/commands/help.md:18`; the list the CLI prints, `packages/core/test/cli.test.ts:9` (`CORE_LIST`)
- What: the page says only `config`, `continue`, `help`, `roles`, `run`, `spawn`, `steer`, `stop`, `ticket` exist when `arthur.config.ts` or a plugin does not load; the CLI then lists `config, continue, doctor, help, jobs, prune, remote-job, roles, run, send, setup, spawn, steer, stop, stopall, ticket, version` (the test "when the config does not load, the core's commands still run…" pins that list). `doctor`, `jobs`, `prune`, `remote-job`, `send`, `setup`, `stopall` and `version` are missing from the page, and so are the refusals of those that need the load.
- Suggestion: the page names the list as the CLI prints it, and which of them refuse without the load; nothing else changes.
- Status: open

## F2. Inside a job the read-only `ci <branch>`, `config check`, `doctor`, `retro` and `usage` are refused with the commands that change state

- Kind: improvement
- Found by: 2026-10-23-ar0353-job-runs-h-comman-77582826 (worker), 2026-10-23
- Where: `packages/github/src/github-ci.ts:20-40` (`arthur ci`, `--rerun` its one write), `packages/core/src/cli.ts` (`config`, `doctor`), `packages/manage/src/retro.ts` (`retro`), `packages/models/src/models.ts` (`usage`)
- What: AR0353's list of the commands a job may run leaves these out, so the gate refuses them inside a job (test/job-gate.test.ts runs each with `ARTHUR_JOB` set: exit 1, the refusal line). Each only reads: a worker handed a failed CI step could read the run itself with `arthur ci <branch>`, but now needs the coordinator to paste the lines.
- Suggestion: decide per command whether a role needs it; for `ci`, `inJob: true` with `--rerun` refused inside a job by the command itself, as `schedule` refuses `add` and `remove`. The others stay refused until a role names a need.
- Status: open
