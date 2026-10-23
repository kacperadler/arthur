# AR0333 - `cd -`, `pushd` with no operand and `$OLDPWD` are read as `cd $HOME`

```json
{
  "id": "AR0333",
  "title": "`cd -`, `pushd` with no operand and `$OLDPWD` are read as `cd $HOME`",
  "date": "2026-10-23"
}
```

## Description

`cd <main>; cd -; cd -; rm README.md` passes: bash is back in the main checkout, the guard thinks it is in the user's home. The same for `pushd <main>; pushd; pushd; rm README.md` and `OLDPWD=<main>; cd -; rm README.md`. (`cd ~-` is refused by luck: `~-` is kept as a literal relative path.)

## Goal

`cd -`, a bare `pushd` and `$OLDPWD` are read as the folder they name (or refused as unknown), not as `$HOME`; tested.

- Kind: bug

Evidence:
- `packages/core/src/worktree-guard.ts:91-94` (`operands` drops `-`, so `operands[0]` is undefined and the folder is `$HOME`; `pushd` alone is treated the same)
- Found by: 2026-10-23-ar0320-security-check-4dea199b (worker), 2026-10-23

## Done means

- The fix, with a test that proves it: keep `previous` beside `cwd`; `cd -` and `cd $OLDPWD`/`~-` go to it, `pushd` with no operand swaps `cwd` with the top of `pushed`; an assignment of `OLDPWD` sets it. Tests: the three commands refused naming the main checkout.
- `npm test` and `npm run check` pass.

## Scope

In:
- keep `previous` beside `cwd`; `cd -` and `cd $OLDPWD`/`~-` go to it, `pushd` with no operand swaps `cwd` with the top of `pushed`; an assignment of `OLDPWD` sets it. Tests: the three commands refused naming the main checkout.

## Decisions

- 2026-10-23: Source: F5 of AR0320
- 2026-10-23: Coordinator (free hand, finding ticket) approved; starts after the ten security checks AR0319-AR0328.
