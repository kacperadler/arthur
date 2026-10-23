# AR0334 - `$ARTHUR_JOB`, the one variable every job's shell has that names a guarded place, is not expanded

```json
{
  "id": "AR0334",
  "title": "`$ARTHUR_JOB`, the one variable every job's shell has that names a guarded place, is not expanded",
  "date": "2026-10-23"
}
```

## Description

`echo x > $ARTHUR_JOB/result` and `echo x > "$ARTHUR_JOB"/../<other job>/result` pass the guard, while the same paths spelled out are refused: the variable's value is a path the guard knows (`worktreeGuard` reads it at `:165`) but the parser turns it into nothing, so the write goes to `/result`, which no place holds. A documented limit for variables in general (`:57`); for this one variable the guard has the value in hand.

## Goal

`$ARTHUR_JOB` is expanded to the job's record before the guard judges a path, so a write through it is judged like the literal path; tested.

- Kind: feat

Evidence:
- `packages/core/src/shell-words.ts:81-100` (`$HOME` and `~` expand to `home`; any other variable is nothing), `packages/core/src/worktree-guard.ts:98`, `:101`, `:138` (the guard passes `process.env.HOME` only)
- Found by: 2026-10-23-ar0320-security-check-4dea199b (worker), 2026-10-23

## Done means

- The fix, with a test that proves it: `shellCommands` takes a map of known variables (`HOME`, `ARTHUR_JOB`) in place of `home`, and the guard passes both. Tests: the two commands refused naming the home folder; `echo $ARTHUR_JOB` passing.
- `npm test` and `npm run check` pass.

## Scope

In:
- `shellCommands` takes a map of known variables (`HOME`, `ARTHUR_JOB`) in place of `home`, and the guard passes both. Tests: the two commands refused naming the home folder; `echo $ARTHUR_JOB` passing.

## Decisions

- 2026-10-23: Source: F6 of AR0320
- 2026-10-23: Coordinator (free hand, finding ticket) approved; starts after the ten security checks AR0319-AR0328.
