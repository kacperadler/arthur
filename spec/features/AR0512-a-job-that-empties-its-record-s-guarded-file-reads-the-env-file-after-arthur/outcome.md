# AR0512 - Outcome

- Merged: 2026-11-02, `f5f2367e`
- Branch: arthur/2026-11-02-worker-fbcd0e18
- Reviews: review-1.md PASS
- Cost: worker $7.31, reviews $0.41; review rounds 1

## What went in

- `packages/core/src/job-scope.ts`: `launch` takes the config and sets `ARTHUR_GUARDED` to `guardedPlaces(config)` in the wrapper's environment, after the prepares' variables.
- `packages/core/src/job-control.ts`: `continueJob` passes `steps.config` to `launch`.
- `packages/core/src/jobs.ts`: the runner passes `{ folder, envFile }` to `launch` at a spawn and to `continueJob`; `writeRecord` gets no config.
- `packages/core/src/remote-job.ts`: the record on another machine is written without a config; its launch builds a list without config lines.
- `packages/core/src/job-record.ts`: the record no longer has a `guarded` file.
- `packages/core/src/job-place.ts`: `jobPlace(record, guarded)` takes the list as an argument; the comments say it comes from `ARTHUR_GUARDED`.
- `packages/core/src/job-sandbox.ts`: `hidden(record, place, guarded)` takes the env file and the install/config exceptions from the list it is given, never from the record.
- `packages/core/src/wrapper.ts`: builds the sandbox from `process.env.ARTHUR_GUARDED`, which the agent inherits.
- `packages/core/src/worktree-guard.ts`: the guard builds its places from `ARTHUR_GUARDED`.
- `packages/core/test/sandbox.test.ts`: the AR0508 continue test now also reads the env file in both runs and scans the record for the token; the old install test about an emptied `guarded` file is folded into it; the `hidden()` unit test proves a planted record file is ignored.
- `packages/core/test/worktree-guard.test.ts`: `jobPlace` gets the launch's list; the end-to-end test refuses a write into the env file; the guard follows `ARTHUR_GUARDED` and ignores the record's file.
- `packages/core/test/spawn.test.ts`: the agent receives the `config`/`env` lines in `ARTHUR_GUARDED`, and the record has no `guarded` file.
- `packages/core/test/model.test.ts`: `ARTHUR_GUARDED` reaches the agent, and a prepare's value does not replace it.
- `packages/core/test/machine.test.ts`: the agent on another machine gets the list without config lines, and no record holds it.
- `packages/core/docs/commands/spawn.md`: the record list drops `guarded`; the wrapper and sandbox sections describe `ARTHUR_GUARDED`, what it holds, and that it is rebuilt at each start.
- `docs/deploy.md`: the threat model says the guarded places come from each launch, not the record.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1422/1493 passed.

## Left open

- Findings: none; no findings.md on this ticket.
