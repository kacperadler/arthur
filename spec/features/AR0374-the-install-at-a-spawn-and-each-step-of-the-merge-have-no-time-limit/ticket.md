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
