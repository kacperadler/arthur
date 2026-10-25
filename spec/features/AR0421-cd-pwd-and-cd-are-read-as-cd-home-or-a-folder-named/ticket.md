# AR0421 - `cd $PWD` and `cd ~+` are read as `cd $HOME` or a folder named `~+`

```json
{
  "id": "AR0421",
  "title": "`cd $PWD` and `cd ~+` are read as `cd $HOME` or a folder named `~+`",
  "date": "2026-10-25"
}
```

## Description

F1 of AR0333 (spec/features/AR0333-cd-pushd-with-no-operand-and-oldpwd-are-read-as-cd-home/findings.md).

- Kind: security
- Found by: 2026-10-25-worker-9a6298d8 (worker), 2026-10-25
- Where: `packages/core/src/shell-words.ts:104`, `packages/core/src/worktree-guard.ts:108`
- What: `shellCommands("cd $PWD; cd ~+; cd \"$PWD\"", "/h")` gives the words `["cd"]`, `["cd","~+"]`, `["cd"]` (seen with `node -e`): `$PWD` expands to nothing, so the guard moves to `$HOME` while bash stays. A bash call with `cwd` the main checkout and `cd $PWD; rm README.md` is judged in the home folder, so it passes [INFERENCE: from the parsed words and `bashRefusal`'s `cd` branch; not run].
- Suggestion: read `$PWD` as `~+` in shell-words.ts, as this ticket reads `$OLDPWD` as `~-`, and have `located` in the guard take `~+` as `cwd`. Out: other variables.

## Goal

`cd $PWD`, `cd "$PWD"` and `cd ~+` are read as the folder the shell is in, so a write after them is judged where bash runs it; tested.

- Kind: security

## Done means

- `$PWD` and `${PWD}` read as `~+` in `shell-words.ts`, and `located` takes `~+` (unquoted, alone or before `/`) as `cwd`. Tests in `worktree-guard.test.ts`: with the bash call's `cwd` in the main checkout, `cd $PWD; rm README.md`, `cd "$PWD"; rm README.md` and `cd ~+; rm README.md` are each refused naming the main checkout; each fails without the fix.
- Both source files stay at 200 lines or under; the core's budget is full, so a fix that needs more ends `Blocked: user` asking for a raise.
- `npm test` and `npm run check` pass.

## Scope

In:
- `packages/core/src/shell-words.ts`, `packages/core/src/worktree-guard.ts`, `packages/core/test/worktree-guard.test.ts`.

Out:
- Other variables; the OLDPWD forms of AR0422.

## Decisions

- 2026-10-25: Source: F1 of AR0333
- 2026-10-25: AR0421 approved as written; the owner: "AR0421 to AR0426 - all" (AR-D22)
