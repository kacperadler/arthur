# AR0497 - A long option of the other wrappers followed by its value still hides the command

```json
{
  "id": "AR0497",
  "title": "A long option of the other wrappers followed by its value still hides the command",
  "date": "2026-10-27"
}
```

## Description

F1 of AR0473 (spec/features/AR0473-a-long-option-of-sudo-or-env-followed-by-its-value-hides-the-command-from-the/findings.md).

- Kind: security
- Found by: 2026-10-27-worker-67871c96 (worker), 2026-10-27
- Where: `packages/core/src/worktree-guard.ts:20` (`WRAPPERS`: only sudo and env list their long options)
- What: `timeout --signal KILL 60 rm <main>/README.md` passes the guard: a row expecting the main checkout, added for a run of `node --test packages/core/test/worktree-guard.test.ts` and removed after, failed with `undefined`; real `timeout --signal KILL 5 echo timeout-ran` printed `timeout-ran`. The same holds, from the lines of `commandIndex`, for `timeout --kill-after`, `nice --adjustment`, `ionice --class`/`--classdata`/`--pid`/`--pgid`/`--uid`, `stdbuf --input`/`--output`/`--error`, GNU `time --format`/`--output` and the long options of `xargs` that take a value (an inference, not run).
- Suggestion: list those wrappers' long options in `WRAPPERS` as sudo and env now are (`=` after those that take a value); `commandIndex` already reads them, prefixes included. A row each in `worktree-guard.test.ts`.

## Goal

`timeout --signal KILL 60 rm <main>/README.md` passes the guard: a row expecting the main checkout, added for a run of `node --test packages/core/test/worktree-guard.test.ts` and removed after, failed with `undefined`; real `timeout --signal KILL 5 echo timeout-ran` printed `timeout-ran`. The same holds, from the lines of `commandIndex`, for `timeout --kill-after`, `nice --adjustment`, `ionice --class`/`--classdata`/`--pid`/`--pgid`/`--uid`, `stdbuf --input`/`--output`/`--error`, GNU `time --format`/`--output` and the long options of `xargs` that take a value (an inference, not run).

- Kind: security

## Done means

- The fix the finding suggests, or one that closes the same gap with less code:
  > list those wrappers' long options in `WRAPPERS` as sudo and env now are (`=` after those that take a value); `commandIndex` already reads them, prefixes included. A row each in `worktree-guard.test.ts`.
- A test row in `packages/core/test/worktree-guard.test.ts` for each command the Goal names, refused naming the main checkout; each fails before the change.
- The project's checks pass.

## Scope

In:
- `packages/core/src/worktree-guard.ts` (at its 200-line cap: free a line or split; a core budget raise is fine).
- `packages/core/test/worktree-guard.test.ts`.

Out:
- The shell parser's other gaps: AR0491 to AR0494, AR0496, AR0497, AR0498, each its own ticket.

## Decisions

- 2026-10-27: Source: F1 of AR0473
- 2026-10-29: Merge a ticket once its review passed, without asking the owner; pre-approved by policy (AR-D218)
