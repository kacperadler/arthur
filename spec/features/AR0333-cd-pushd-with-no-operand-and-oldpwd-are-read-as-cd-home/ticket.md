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

- Kind: fix

Evidence:
- `packages/core/src/worktree-guard.ts:91-94` (`operands` drops `-`, so `operands[0]` is undefined and the folder is `$HOME`; `pushd` alone is treated the same)
- Found by: 2026-10-23-ar0320-security-check-4dea199b (worker), 2026-10-23

## Done means

- The fix, with a test that proves it: keep `previous` beside `cwd`; `cd -` and `cd $OLDPWD`/`~-` go to it, `pushd` with no operand swaps `cwd` with the top of `pushed`; an assignment of `OLDPWD` sets it. Tests: the three commands refused naming the main checkout.
- Also followed, as reviews 1 to 3 asked (each tested): `OLDPWD=`, `OLDPWD+=`, `export`/`declare`/`typeset` of OLDPWD, `unset OLDPWD` (not `unset -f`), an empty OLDPWD refused as unset, a subshell restoring it, a prefix `OLDPWD=` before `cd`, a shell (`bash -c`, `env … bash -c`) or `eval`, `$OLDPWD`/`${OLDPWD}`/`~-` inside paths and redirects.
- `npm test` and `npm run check` pass.

## Scope

In:
- keep `previous` beside `cwd`; `cd -` and `cd $OLDPWD`/`~-` go to it, `pushd` with no operand swaps `cwd` with the top of `pushed`; an assignment of `OLDPWD` sets it. Tests: the three commands refused naming the main checkout.

Out (split off by AR-D17 after review 3):
- `${OLDPWD…}` with an operator (`:-`, `-`, `=`, `%`, `#`, `/`), `readonly`/`declare -r OLDPWD`, `local OLDPWD=` outside a function, a bare `pushd -n`, and a prefix `OLDPWD+=` before `eval`: AR0420. Each was missed before this ticket too.

## Decisions

- 2026-10-23: Source: F5 of AR0320
- 2026-10-23: Coordinator (free hand, finding ticket) approved; starts after the ten security checks AR0319-AR0328.
- 2026-10-25: AR0333 gets another round: the worker fixes review 2 findings, then review round 3; the owner: "AR-D14 - 1" (AR-D14)
- 2026-10-25: AR0333 split: narrowed to what the branch fixes, a new ticket for the 5 forms review 3 found, the branch reviewed again (round 4); the owner: "AR-D17 - 2" (AR-D17)
