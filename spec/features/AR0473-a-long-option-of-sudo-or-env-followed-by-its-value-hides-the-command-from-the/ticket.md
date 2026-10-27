# AR0473 - A long option of sudo or env followed by its value hides the command from the guard

```json
{
  "id": "AR0473",
  "title": "A long option of sudo or env followed by its value hides the command from the guard",
  "date": "2026-10-27"
}
```

## Description

A job can still hide a command from the worktree guard behind a long option of `sudo` or `env` that takes a value as the next word: the guard reads the value as the command.

## Goal

Source: note 2 of AR0429's review-2: `sudo --user root rm <main>/README.md` and `env --unset X rm <main>/README.md` pass the guard, on the code before AR0429 too. `packages/core/src/worktree-guard.ts` (`commandIndex`).

- Kind: security

## Done means

- Both commands are refused naming the main checkout, and the other long options of sudo and env that take a value are skipped with it; rows in `packages/core/test/worktree-guard.test.ts` that fail without the fix.

## Scope

In:
- `packages/core/src/worktree-guard.ts`, `packages/core/test/worktree-guard.test.ts`.

Out:
- Other guard forms: AR0471.

## Decisions

- 2026-10-27: Source: F3 of AR0429
- 2026-10-27: AR0473 approved by the owner (morning of 2026-10-27, one list of 18); the owner: "apprvoed: AR0467, AR0466, AR0471-AR0473, AR0464, AR0465, AR0468-AR0470, AR0474-AR0477, AR0402-AR0405" (AR-D128)
