# AR0494 - The guard skips an escaped quote inside quotes when it finds a fallback end, so a command can hide after it

```json
{
  "id": "AR0494",
  "title": "The guard skips an escaped quote inside quotes when it finds a fallback end, so a command can hide after it",
  "date": "2026-10-27"
}
```

## Description

F4 of AR0471 (spec/features/AR0471-other-operators-of-pwd-and-of-the-known-variables-read-as-nothing/findings.md).

## Goal

`closing()` (`packages/core/src/shell-words.ts:39`), which finds the end of a `${…}`, skips quotes without honouring `\"` inside them. So `echo "${x:-"\""}"; rm X` hides `rm X` from the worktree guard, while bash runs it. Found by review 2026-10-27-review-804fd865 of AR0471; it is there on main before AR0471 as well.

- Kind: security

## Done means

- `closing()` honours a backslash inside double quotes as bash does, so the `${…}` ends where bash ends it and the command after it is judged.
- A test row in `packages/core/test/worktree-guard.test.ts`: `echo "${x:-"\""}"; rm ../../acme/README.md` refused naming the main checkout; it fails before the change.
- The project's checks pass.

## Scope

In:
- `packages/core/src/shell-words.ts` (at its 200-line cap: free a line or split, a core budget raise is fine).
- `packages/core/test/worktree-guard.test.ts`.

Out:
- AR0491 (a command substitution in a fallback), AR0492 (`~user`): their own tickets.

## Decisions

- 2026-10-27: Source: F4 of AR0471
