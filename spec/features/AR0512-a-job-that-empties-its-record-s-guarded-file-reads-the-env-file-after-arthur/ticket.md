# AR0512 - A job that empties its record's `guarded` file reads the env file after `arthur continue`

```json
{
  "id": "AR0512",
  "title": "A job that empties its record's `guarded` file reads the env file after `arthur continue`",
  "date": "2026-10-27"
}
```

## Description

F1 of AR0508 (spec/features/AR0508-a-sandboxed-job-reads-arthur-s-ssh-private-key-and-with-it-gets-an-unconfined/findings.md).

- Kind: security
- Found by: 2026-10-27-worker-6355f513 (worker), 2026-10-27
- Where: `packages/core/src/job-sandbox.ts:79-82` (`hidden` reads the env file's path from the record), `packages/core/src/wrapper.ts:122` (read once per wrapper, so anew at each continue), `packages/core/src/job-sandbox.ts:67-75` (`writable`: the record is writable)
- What: the record is writable to the agent's sandbox, so any program the job runs can run `: > "$ARTHUR_JOB/guarded"`. The next wrapper, started by `arthur continue`, reads an empty list and hides no env file, so the continued run reads every token in it. Reproduced: an agent script that runs `{ cat <env file> || echo refused; } >> env-read 2>&1; : > "$ARTHUR_JOB/guarded"` in the AR0508 test of `packages/core/test/sandbox.test.ts`, across `jobs.continue`, wrote `Permission denied\nrefused\n` in the first run and `ARTHUR_SECRET_TOKEN=s3cret-t0ken` in the second. The same empty list also stops the worktree guard from naming any guarded place (it reads `jobPlace(record)` on each call); the sandbox still refuses those writes. `~/.ssh` is not affected: `hidden` takes it from the user's home, not from the record (AR0508).
- Suggestion: give the wrapper the env file's path from outside the record (the runner knows `core.envFile`; on another machine there is none), or keep `guarded` where the job's sandbox cannot write it, and add the continue case to the test above. Out: the network.

## Goal

<!-- What we are after, what it moves in spec/vision.md, and the evidence (file:line, a command and its output). -->

- Kind: security

## Done means

<!-- Each observable result, and the test that proves it; the project's checks pass. -->

## Scope

In:
<!-- - `path/to/file.ts`: what changes there. -->

Out:
<!-- - What this ticket does not do, and which ticket does. -->

## Decisions

- 2026-10-27: Source: F1 of AR0508
