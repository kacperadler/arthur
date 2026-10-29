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

The sandbox hides `join(homedir(), ".ssh")` (`packages/core/src/job-sandbox.ts:81`, `:117`; `packages/core/src/job-place.ts:24`), and `homedir()` follows `$HOME`, while OpenSSH finds the home from the user account. With `$HOME` set elsewhere, the `.ssh` ssh really uses stays readable to a job.

- Kind: security

## Done means

- The hidden `.ssh` is the user account's (`os.userInfo().homedir`), and also `$HOME`'s when the two differ; a test with `HOME` set to another folder shows the account's `.ssh` hidden from the job.
- The `guarded` file's `ssh` line names the same folder or folders.
- `npm run check` and `npm test` pass.

## Scope

In:
- `packages/core/src/job-sandbox.ts`, `packages/core/src/job-place.ts`.
- Their tests.

Out:
- Other credentials outside `~/.ssh`: AR0513.

## Decisions

- 2026-10-27: Source: F4 of AR0508
- 2026-10-29: Raise the core line budget by what the fix needs, without asking the owner; pre-approved by policy (AR-D63)
- 2026-10-29: Merge a ticket once its review passed, without asking the owner; pre-approved by policy (AR-D218)

