# AR0491 - A command substitution inside a fallback word is never judged

```json
{
  "id": "AR0491",
  "title": "A command substitution inside a fallback word is never judged",
  "date": "2026-10-27"
}
```

## Description

F1 of AR0471 (spec/features/AR0471-other-operators-of-pwd-and-of-the-known-variables-read-as-nothing/findings.md).

- Kind: security
- Found by: 2026-10-27-worker-c28e3457 (worker), 2026-10-27
- Where: `packages/core/src/shell-words.ts:93`
- What: the `dollar` branch for `${…}` parses a fallback word (`${x:-word}`, also `=`, `+`, `?`) only for its words and drops the commands of a `$(…)` or a backtick substitution in it, so they never reach `before` and the guard never sees them. A row `["bash", { command: "echo ${x:-$(rm ../../acme/README.md)}" }, MAIN]` in `packages/core/test/worktree-guard.test.ts` fails with `undefined`; bash runs the `rm` when `x` is unset. It was there before AR0471 (`shellWords` dropped them too).
- Suggestion: push the items of the fallback's substitutions (those between a `(` and its `)` in `shellCommands(fallback[1]!, known)`) into `before`, not the fallback's own words, so `echo ${x:-rm a}` stays a word; `shell-words.ts` is at its 200-line cap, so the fix needs a line freed or a split.

## Goal

the `dollar` branch for `${…}` parses a fallback word (`${x:-word}`, also `=`, `+`, `?`) only for its words and drops the commands of a `$(…)` or a backtick substitution in it, so they never reach `before` and the guard never sees them. A row `["bash", { command: "echo ${x:-$(rm ../../acme/README.md)}" }, MAIN]` in `packages/core/test/worktree-guard.test.ts` fails with `undefined`; bash runs the `rm` when `x` is unset. It was there before AR0471 (`shellWords` dropped them too).

- Kind: security

## Done means

- The fix the finding suggests, or one that closes the same gap with less code:
  > push the items of the fallback's substitutions (those between a `(` and its `)` in `shellCommands(fallback[1]!, known)`) into `before`, not the fallback's own words, so `echo ${x:-rm a}` stays a word; `shell-words.ts` is at its 200-line cap, so the fix needs a line freed or a split.
- A test row in `packages/core/test/worktree-guard.test.ts` for the command the Goal names, refused; it fails before the change.
- The project's checks pass.

## Scope

In:
- `packages/core/src/shell-words.ts` (at its 200-line cap: free a line or split; a core budget raise is fine).
- `packages/core/test/worktree-guard.test.ts`.

Out:
- The other gaps of the same parser: AR0491 to AR0494, each its own ticket.

## Decisions

- 2026-10-27: Source: F1 of AR0471
- 2026-10-29: Merge a ticket once its review passed, without asking the owner; pre-approved by policy (AR-D218)
