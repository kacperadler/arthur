# AR0374 - The install at a spawn and each step of the merge have no time limit

```json
{
  "id": "AR0374",
  "title": "The install at a spawn and each step of the merge have no time limit",
  "date": "2026-10-23"
}
```

## Description

an install that waits (a registry that never answers, a lifecycle script that reads stdin or sleeps) holds `arthur spawn` open for ever, with the job's worktree and record already written and no scope to kill it; a `check` or `test` script on main that hangs holds `arthur merge` open with the merge commit already on main, nothing filed, nothing reset, until someone kills the process by hand; the refusals a second `arthur merge` makes meanwhile (`merge-command.ts:59-80`: no branch, no identity, a dirty or detached main, nothing new) name no merge in progress, so by those lines it would merge on top of the unchecked commit (not run). Nothing in the code covers a step that does not return.

## Goal

The install at a spawn and each merge step have a time limit, and a step past it is stopped and named; tested.

- Kind: security

Evidence:
- `packages/projects/src/install.ts:37` (`host.jobs.run(job.machine, [...])` with no `limitSeconds`), `packages/core/src/job-machine.ts:102` (the timer only when one is given; the nvm prepare beside it passes `LIMIT_SECONDS`, `packages/nvm/src/nvm.ts:11`, `:57`), `packages/delivery/src/merge-checks.ts:63` (`spawnSync` with `maxBuffer` but no `timeout`)
- Found by: 2026-10-23-ar0328-security-check-41d0fc72 (worker), 2026-10-23

## Done means

- The fix, with a test that proves it: a limit on both, as one number in the delivery and projects options or a constant each (the install: `limitSeconds` to `host.jobs.run`, which already kills and reports `timed out after <n> s`; the merge: `timeout` and `killSignal: "SIGKILL"` to `spawnSync`, a step whose `ran.signal` is set reported `failed, timed out after <n> s.`), named in `docs/commands/projects.md`, "Install", and `docs/commands/merge.md`, "Checks on main". Tests: `install.test.ts`, a fake install that sleeps past a one-second limit refuses the spawn with `timed out after 1 s` and leaves no worktree or record; `merge.test.ts`, a `test` script that sleeps past the limit is a failed step, main reset, main's install put back.
- `npm test` and `npm run check` pass.

## Scope

In:
- a limit on both, as one number in the delivery and projects options or a constant each (the install: `limitSeconds` to `host.jobs.run`, which already kills and reports `timed out after <n> s`; the merge: `timeout` and `killSignal: "SIGKILL"` to `spawnSync`, a step whose `ran.signal` is set reported `failed, timed out after <n> s.`), named in `docs/commands/projects.md`, "Install", and `docs/commands/merge.md`, "Checks on main". Tests: `install.test.ts`, a fake install that sleeps past a one-second limit refuses the spawn with `timed out after 1 s` and leaves no worktree or record; `merge.test.ts`, a `test` script that sleeps past the limit is a failed step, main reset, main's install put back.

## Decisions

- 2026-10-23: Source: F2 of AR0328
- 2026-10-23: Coordinator (free hand, finding ticket) approved; starts after the ten security checks AR0319-AR0328.
- 2026-10-26 (worker): since AR0373 the install no longer runs in `arthur spawn` through `host.jobs.run` but in the job's wrapper (`ARTHUR_INSTALL`), after the spawn returned, so no spawn waits on it and there is no `limitSeconds` to pass: its limit is the job's timeout, which the wrapper already counted from its start. The wrapper now names it: `limit: time: stopping the install` in the log, the end reason `limit: time: the job ran past its timeout of <n> minutes, during its install`, no agent started. Its test is in `packages/core/test/limits.test.ts`, not `install.test.ts` (the projects plugin only hands the command over); a timeout of 0 stays no limit, for the install too.
- 2026-10-26 (worker): the merge's limit is delivery's option `merge.stepSeconds`, default 3600, so a test can set 3; a step past it is `failed, timed out after <n> s.`, recognised by spawnSync's `ETIMEDOUT` error rather than any `ran.signal`, so a step killed by another signal is not called a timeout. Delivery's line budget raised 1436 to 1449, recorded in `test/structure.test.ts`.
- 2026-10-26: Raise the delivery line budget to 1449 for AR0374 (AR-D61); the owner: "IF YOU NEED THEN ADD MORE LINES TO THE CORE, TO NOT ASK ME ABOUT THIS" (AR-D110)
- 2026-10-26: Accept merge.stepSeconds (default 3600 s) for merge steps and the job timeout as the install limit, for AR0374 (the coordinator's recommendation, under AR-D98); the owner: "always go with your recommendation" (AR-D111)
- 2026-10-26: Merge a ticket once its review passed, without asking the owner; pre-approved by policy (AR-D74)
