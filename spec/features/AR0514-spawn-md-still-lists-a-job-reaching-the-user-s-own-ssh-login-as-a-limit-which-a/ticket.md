# AR0514 - spawn.md still lists a job reaching the user's own SSH login as a limit, which a hidden ~/.ssh mostly ends

```json
{
  "id": "AR0514",
  "title": "spawn.md still lists a job reaching the user's own SSH login as a limit, which a hidden ~/.ssh mostly ends",
  "date": "2026-10-27"
}
```

## Description

F3 of AR0508 (spec/features/AR0508-a-sandboxed-job-reads-arthur-s-ssh-private-key-and-with-it-gets-an-unconfined/findings.md).

- Kind: docs
- Found by: 2026-10-27-review-bc8c068f (review), 2026-10-27
- Where: `packages/core/docs/commands/spawn.md:120`
- What: the limits still list "a job reaching the user's own SSH login (`ssh localhost`)". With `~/.ssh` hidden (AR0508) that works only through a password or another stored credential, so the line is stale, though not wrong.
- Suggestion: reword the line to say the key is hidden and what still reaches the login (a password, another stored credential).

## Goal

The SSH docs say what is true since AR0508 hid `~/.ssh` from jobs. Evidence: `packages/core/docs/commands/spawn.md:120` still lists "a job reaching the user's own SSH login (`ssh localhost`)" as a limit.

- Kind: docs

## Done means

- `spawn.md`'s limits say the SSH key is hidden from a job, and that the user's login is still reachable through a password or another stored credential.
- `npm run check` and `npm test` pass.

## Scope

In:
- `packages/core/docs/commands/spawn.md`.

Out:
- The sandbox itself: unchanged.

## Decisions

- 2026-10-27: Source: F3 of AR0508
