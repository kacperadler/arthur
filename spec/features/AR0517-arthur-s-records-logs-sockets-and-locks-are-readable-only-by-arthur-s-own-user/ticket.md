# AR0517 - Arthur's records, logs, sockets and locks are readable only by Arthur's own user

```json
{
  "id": "AR0517",
  "title": "Arthur's records, logs, sockets and locks are readable only by Arthur's own user",
  "date": "2026-10-27"
}
```

## Description

Part of AR0402's area 2 (files and processes), cut as a defensive change with its test instead of an open review, after AR0402's review was refused twice by the provider.

## Goal

Every file and folder Arthur writes for its own state (job records, logs, the coordinator's and jobs' tmux sockets, locks, under the home folder and `/tmp`) is created with modes that only Arthur's own user can read or write, so another account on the machine reads no record, log or socket.

- Kind: security

## Done means

- A test creates a job, a lock and a log in a temporary home and asserts each file's mode allows no group or other access (`0o600` for files, `0o700` for folders); it fails before the change on any file written with the default umask.
- A tmux socket Arthur names lives in a folder only its user can enter.
- `npm run check` and `npm test` pass.

## Scope

In:
- The core's files that create records, logs and locks (`packages/core/src/job-record.ts`, `wrapper.ts` and the lock writers): an explicit mode, or a `0o077` umask for Arthur's process.
- The tmux socket path of `orchestration` and the job runner.
- `packages/core/test/`: the mode test above.

Out:
- What another process of the same user can read: that is the sandbox's job (AR0376, AR0508).
- Secrets in the content of these files: AR0518.

## Decisions

- 2026-10-27: Source: AR0402, refused twice by the provider
- 2026-10-27: Raise the orchestration line budget from 2421 to 2430 for AR0517, by the owner standing rule AR-D61; the owner: "IF YOU NEED THEN ADD MORE LINES TO THE CORE, TO NOT ASK ME ABOUT THIS" (AR-D186)
