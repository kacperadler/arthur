# AR0386 - Inside a job the read-only `ci <branch>`, `config check`, `doctor`, `retro` and `usage` are refused with the commands that change state

```json
{
  "id": "AR0386",
  "title": "Inside a job the read-only `ci <branch>`, `config check`, `doctor`, `retro` and `usage` are refused with the commands that change state",
  "date": "2026-10-23"
}
```

## Description

AR0353's list of the commands a job may run leaves these out, so the gate refuses them inside a job (test/job-gate.test.ts runs each with `ARTHUR_JOB` set: exit 1, the refusal line). Each only reads: a worker handed a failed CI step could read the run itself with `arthur ci <branch>`, but now needs the coordinator to paste the lines.

## Goal

A job may run the read-only `ci <branch>`, `config check`, `doctor`, `retro` and `usage` (declared inJob), while their state-changing steps stay refused; tested.

- Kind: feat

Evidence:
- `packages/github/src/github-ci.ts:20-40` (`arthur ci`, `--rerun` its one write), `packages/core/src/cli.ts` (`config`, `doctor`), `packages/manage/src/retro.ts` (`retro`), `packages/models/src/models.ts` (`usage`)
- Found by: 2026-10-23-ar0353-job-runs-h-comman-77582826 (worker), 2026-10-23

## Done means

- The fix, with a test that proves it: decide per command whether a role needs it; for `ci`, `inJob: true` with `--rerun` refused inside a job by the command itself, as `schedule` refuses `add` and `remove`. The others stay refused until a role names a need.
- `npm test` and `npm run check` pass.

## Scope

In:
- decide per command whether a role needs it; for `ci`, `inJob: true` with `--rerun` refused inside a job by the command itself, as `schedule` refuses `add` and `remove`. The others stay refused until a role names a need.

## Decisions

- 2026-10-23: Source: F2 of AR0353
- 2026-10-23: Coordinator (free hand, finding ticket) approved; runs one at a time after the high-severity security fixes.
- 2026-10-25: Worker: of the five, only `ci` gets `inJob: true`: a worker handed a failed CI step reads the run itself; no job role names `config check`, `doctor`, `retro` or `usage`, so they stay refused. `ci --rerun` refuses itself inside a job after its usage check, before anything is asked of GitHub, as `schedule add` does. github's line budget 654 to 658 (test/structure.test.ts) for `inJob: true` and the refusal with its comment.
