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

<!-- What we are after, what it moves in spec/vision.md, and the evidence (file:line, a command and its output). -->

- Kind: security

## Done means

<!-- Each observable result, and the test that proves it; the project's checks pass. -->

## Scope

In:
<!-- - `path/to/file.ts`: what changes there. -->

Out:
<!-- - What this ticket does not do, and which ticket does. -->

## Decisions

- 2026-10-25: Source: F1 of AR0333
