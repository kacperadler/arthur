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

<!-- What we are after, what it moves in spec/vision.md, and the evidence (file:line, a command and its output). -->

- Kind: docs

## Done means

<!-- Each observable result, and the test that proves it; the project's checks pass. -->

## Scope

In:
<!-- - `path/to/file.ts`: what changes there. -->

Out:
<!-- - What this ticket does not do, and which ticket does. -->

## Decisions

- 2026-10-27: Source: F3 of AR0508

<!-- - YYYY-MM-DD: one decision the human made, in one line. -->
