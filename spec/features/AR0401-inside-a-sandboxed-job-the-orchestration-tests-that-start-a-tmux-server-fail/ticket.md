# AR0401 - Inside a sandboxed job, the orchestration tests that start a tmux server fail

```json
{
  "id": "AR0401",
  "title": "Inside a sandboxed job, the orchestration tests that start a tmux server fail",
  "date": "2026-10-25"
}
```

## Description

the sandbox refuses every new Unix socket (so a job reaches neither the user manager's bus nor a tmux server outside it), and so tmux cannot make its own server's socket either. Run under the sandbox, `node --import @arthur/core/testing --test packages/orchestration/test/coordinator.test.ts` prints `orchestration: coordinator start failed: tmux new-session: error connecting to /tmp/arthur-test-…/tmux.sock (Permission denied)` again and again. A worker on Arthur itself that runs `npm test` will see these tests fail; `arthur merge` runs the checks outside the sandbox, where they pass.

## Goal

A worker inside the job sandbox runs `npm test` with every test passing: the orchestration tests that start a tmux server either get a socket path the sandbox allows or skip with a reason, so a worker's checks match what `arthur merge` runs.

- Kind: test

## Done means

- The fix, with a test that proves it: those tests skip, naming why, where a Unix socket cannot be made (one `socket()` probe at load, as `doctor.test.ts` skips for root); the sandbox stays as it is. Out: allowing Unix sockets in the sandbox, which would give the job the user manager's bus again.
- `npm test` and `npm run check` pass.

## Scope

In:
- those tests skip, naming why, where a Unix socket cannot be made (one `socket()` probe at load, as `doctor.test.ts` skips for root); the sandbox stays as it is. Out: allowing Unix sockets in the sandbox, which would give the job the user manager's bus again.

## Decisions

- 2026-10-25: Source: F1 of AR0376
