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

A job's agent never reads the env file, also after `arthur continue`. Today the job's record is writable to its own sandbox, so a program the job runs can empty `$ARTHUR_JOB/guarded`; the next wrapper, started by `arthur continue`, reads an empty list and hides no env file, and the continued run reads every token in it (F1 of AR0508, reproduced in `packages/core/test/sandbox.test.ts`; the read is in `packages/core/src/job-sandbox.ts:99-111`, once per wrapper in `packages/core/src/wrapper.ts`).

- Kind: security

## Done means

- What the sandbox hides from a job (the env file) and the places the worktree guard names no longer depend on a file the job can write: the wrapper gets them from where the job's sandbox cannot write (the runner's own config, or a file outside every writable path), on this machine and on another one.
- A test in `packages/core/test/sandbox.test.ts`: a job's agent empties its record's `guarded` file, the job is continued, and the continued run's read of the env file is still refused; it fails before the change.
- `npm run check` and `npm test` pass.

## Scope

In:
- `packages/core/src/job-sandbox.ts`: where the hidden env file comes from.
- `packages/core/src/wrapper.ts`: what the wrapper reads at each start.
- `packages/core/src/job-record.ts` or `packages/core/src/job-place.ts`, if `guarded` moves.
- `packages/core/test/sandbox.test.ts`: the continue case above.

Out:
- The network, and credentials outside `~/.ssh` and the env file: AR0513.

## Decisions

- 2026-10-27: Source: F1 of AR0508
- 2026-11-02: Approved: build AR0512 after AR0562, as part of Groups 1 and 2; report progress as tasks X/Y and new Z; the owner: "complete the AR0562, then go with Group 1 and Group 2, but mesure this changes i mean, whan you start, add to messages tasks: X/Y new: Z (tasks: X is completed / Y is todo; new: Z is how many new are created when you do the Y tasks)" (AR-D435)
