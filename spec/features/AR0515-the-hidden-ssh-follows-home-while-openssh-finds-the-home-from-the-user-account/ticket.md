# AR0515 - The hidden ~/.ssh follows $HOME, while OpenSSH finds the home from the user account

```json
{
  "id": "AR0515",
  "title": "The hidden ~/.ssh follows $HOME, while OpenSSH finds the home from the user account",
  "date": "2026-10-27"
}
```

## Description

F4 of AR0508 (spec/features/AR0508-a-sandboxed-job-reads-arthur-s-ssh-private-key-and-with-it-gets-an-unconfined/findings.md).

- Kind: security
- Found by: 2026-10-27-review-ae770173 and 2026-10-27-review-bc8c068f (reviews), 2026-10-27
- Where: `packages/core/src/job-sandbox.ts:81`, `:117` (`join(homedir(), ".ssh")`), `packages/core/src/job-place.ts:24` (the `guarded` file's `ssh` line, from the same source)
- What: `homedir()` follows `$HOME`, while OpenSSH finds the home folder from the user account (`getpwuid`). If Arthur ever runs with a `$HOME` other than the account's, the sandbox hides the wrong `.ssh` and the key `ssh` really uses stays readable.
- Suggestion: take the home from the user account (`os.userInfo().homedir`) for the hidden `.ssh`, or hide both when they differ; a test with `HOME` set elsewhere.

## Goal

<!-- What we are after, what it moves in spec/vision.md, and the evidence (file:line, a command and its output). -->

- Kind: <!-- feat | fix | security | perf | refactor | test | docs | build | ci | chore | ux -->

## Done means

<!-- Each observable result, and the test that proves it; the project's checks pass. -->

## Scope

In:
<!-- - `path/to/file.ts`: what changes there. -->

Out:
<!-- - What this ticket does not do, and which ticket does. -->

## Decisions

- 2026-10-27: Source: F4 of AR0508

<!-- - YYYY-MM-DD: one decision the human made, in one line. -->
