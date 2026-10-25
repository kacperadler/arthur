# AR0420 - Outcome

- Merged: 2026-10-25, `ccecf8b7`
- Branch: arthur/2026-10-25-worker-3e326757
- Reviews: review-1.md FAIL, review-2.md FAIL, review-3.md FAIL, review-4.md PASS
- Cost: worker $7.31, reviews n/a; review rounds 4

## What went in

- `packages/core/src/shell-words.ts`: `${OLDPWD:-x}`, `${OLDPWD-x}`, `${OLDPWD=x}`, `${OLDPWD?x}` read as `~-`; any other `${OLDPWD…}` operator makes OLDPWD unknown.
- `packages/core/src/worktree-guard.ts`: `readonly`/`declare -r` OLDPWD stops later `cd`s from moving it; any `local` naming OLDPWD makes it unknown (AR-D21), so a later `cd -`, `pushd -`, `~-` or `$OLDPWD` is refused; `pushd -n` and `popd -n` leave the folder; the `eval` restore follows `OLDPWD+=`; `OLDPWD[0]=` and `OLDPWD=(…)` are followed.
- `packages/core/test/worktree-guard.test.ts`: a row per form, each refused naming the main checkout or OLDPWD unknown, and rows pinning each condition the reviews mutated.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1119/1119 passed.

## Left open

- Tickets from findings: AR0430 (F2, F3, F4, planning: the owner's AR-D35 drops exotic guard forms, so it waits for his word); F5-F7 dropped.
