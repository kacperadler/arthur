# AR0338 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. A variable set in the shell alone passes `config check` but is missing for every `arthur` command a job runs

- Kind: ux
- Found by: 2026-10-25-worker-edc68b52 (worker), 2026-10-25
- Where: `packages/core/src/config-check.ts:24`, `packages/core/src/env.ts:71`
- What: since this ticket no `ARTHUR_` variable of Arthur's shell reaches a job, so a job's `arthur` reads the `...Env` variables from `core.envFile` only. With a variable exported in the shell and absent from the env file, `arthur config check` and `arthur setup` say `set`, yet each config-loading command inside a job refuses: `env -i PATH="$PATH" HOME="$HOME" ARTHUR_JOB=/x/jobs/2026-10-25-worker-0 node ../packages/core/src/cli.ts jobs` in a folder whose config names `ARTHUR_YOUTRACK_TOKEN` and has no env file printed `arthur jobs: arthur.config.ts did not load: ... ARTHUR_YOUTRACK_TOKEN is missing: not in the shell nor in .../vars, which does not exist`, exit 1; with the variable in `vars`, `No jobs`, exit 0. `docs/commands/config.md` now says so; nothing warns at the check.
- Suggestion: `config check` and `setup` print a line (not a failure) for each variable set in the shell but not in the env file: `ARTHUR_X is set in the shell only; a job's arthur does not see it, put it in <envFile>`. Out: passing the shell's values into jobs again.
- Status: ticket AR0438

## F2. A provider's key exported in the shell still reaches every job

- Kind: security
- Found by: 2026-10-25-worker-edc68b52 (worker), 2026-10-25
- Where: `packages/core/src/job-scope.ts:68`
- What: `launch` drops only `ARTHUR_` variables (this ticket's scope), so a key the agent's providers read from the environment, such as `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` exported in the shell that started Arthur, is in the agent's environment and so in every tool call's (`env`), which the env guard does not refuse. The agent may need it to run, so dropping it blindly would break a setup that logs omp in through the shell.
- Suggestion: document that a provider's key belongs in omp's own login (`~/.omp`) or comes through the models plugin's `prepare`, and have `arthur doctor` warn about a known provider key in Arthur's environment. Out: dropping such keys in `launch` without the owner's decision.
- Status: ticket AR0439
