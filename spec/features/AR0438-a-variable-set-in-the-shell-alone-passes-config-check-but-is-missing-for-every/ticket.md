# AR0438 - A variable set in the shell alone passes `config check` but is missing for every `arthur` command a job runs

```json
{
  "id": "AR0438",
  "title": "A variable set in the shell alone passes `config check` but is missing for every `arthur` command a job runs",
  "date": "2026-10-25"
}
```

## Description

F1 of AR0338 (spec/features/AR0338-a-secret-exported-in-the-shell-reaches-every-job-s-environment/findings.md).

- Kind: ux
- Found by: 2026-10-25-worker-edc68b52 (worker), 2026-10-25
- Where: `packages/core/src/config-check.ts:24`, `packages/core/src/env.ts:71`
- What: since this ticket no `ARTHUR_` variable of Arthur's shell reaches a job, so a job's `arthur` reads the `...Env` variables from `core.envFile` only. With a variable exported in the shell and absent from the env file, `arthur config check` and `arthur setup` say `set`, yet each config-loading command inside a job refuses: `env -i PATH="$PATH" HOME="$HOME" ARTHUR_JOB=/x/jobs/2026-10-25-worker-0 node ../packages/core/src/cli.ts jobs` in a folder whose config names `ARTHUR_YOUTRACK_TOKEN` and has no env file printed `arthur jobs: arthur.config.ts did not load: ... ARTHUR_YOUTRACK_TOKEN is missing: not in the shell nor in .../vars, which does not exist`, exit 1; with the variable in `vars`, `No jobs`, exit 0. `docs/commands/config.md` now says so; nothing warns at the check.
- Suggestion: `config check` and `setup` print a line (not a failure) for each variable set in the shell but not in the env file: `ARTHUR_X is set in the shell only; a job's arthur does not see it, put it in <envFile>`. Out: passing the shell's values into jobs again.

## Goal

`arthur config check` and `arthur setup` say when a variable is set in the shell only, so the owner puts it in the env file before a job's `arthur` misses it; tested.

- Kind: fix

## Done means

- For each `...Env` variable set in the shell but not in `core.envFile`, both print `ARTHUR_X is set in the shell only; a job's arthur does not see it, put it in <envFile>` (a warning, not a failure), without the value. Test in `packages/core/test/config-check.test.ts`: one variable in the shell only, one in both; only the first gets the line. It fails on main.
- `npm test` and `npm run check` pass; core's budget may be raised by the lines needed (AR-D29).

## Scope

In:
- `packages/core/src/config-check.ts`, `packages/core/test/config-check.test.ts`, `packages/core/docs/commands/config.md`.

Out:
- Passing the shell's values into jobs again.

## Decisions

- 2026-10-25: Source: F1 of AR0338
- 2026-10-25: AR0438 approved under AR-D31, group 2; the owner: "always go with recommendation till the 8 am morning" (AR-D44)
