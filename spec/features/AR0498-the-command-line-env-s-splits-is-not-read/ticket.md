# AR0498 - The command line `env -S` splits is not read

```json
{
  "id": "AR0498",
  "title": "The command line `env -S` splits is not read",
  "date": "2026-10-27"
}
```

## Description

F2 of AR0473 (spec/features/AR0473-a-long-option-of-sudo-or-env-followed-by-its-value-hides-the-command-from-the/findings.md).

- Kind: security
- Found by: 2026-10-27-worker-67871c96 (worker), 2026-10-27
- Where: `packages/core/src/worktree-guard.ts:20` (`-S` and `--split-string=` are skipped as an option value)
- What: `env -S 'rm <main>/README.md'` passes the guard: a row expecting the main checkout, added for a run of `node --test packages/core/test/worktree-guard.test.ts` and removed after, failed with `undefined`; real `env -S 'echo split-ran'` printed `split-ran`. env splits the value into words and runs them, the words after it appended.
- Suggestion: read the value of `env -S`/`--split-string` as the start of the command (split as `bash -c` text is, before the words after it), or refuse an `env -S` whose value the guard cannot split; a row each.

## Goal

`env -S 'rm <main>/README.md'` passes the guard: a row expecting the main checkout, added for a run of `node --test packages/core/test/worktree-guard.test.ts` and removed after, failed with `undefined`; real `env -S 'echo split-ran'` printed `split-ran`. env splits the value into words and runs them, the words after it appended.

- Kind: security

## Done means

- The fix the finding suggests, or one that closes the same gap with less code:
  > read the value of `env -S`/`--split-string` as the start of the command (split as `bash -c` text is, before the words after it), or refuse an `env -S` whose value the guard cannot split; a row each.
- A test row in `packages/core/test/worktree-guard.test.ts` for each command the Goal names, refused naming the main checkout; each fails before the change.
- The project's checks pass.

## Scope

In:
- `packages/core/src/worktree-guard.ts` (at its 200-line cap: free a line or split; a core budget raise is fine).
- `packages/core/test/worktree-guard.test.ts`.

Out:
- The shell parser's other gaps: AR0491 to AR0494, AR0496, AR0497, AR0498, each its own ticket.

## Decisions

- 2026-10-27: Source: F2 of AR0473
