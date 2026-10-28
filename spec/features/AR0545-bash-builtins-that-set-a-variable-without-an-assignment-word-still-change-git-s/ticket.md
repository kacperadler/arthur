# AR0545 - Bash builtins that set a variable without an assignment word still change git's config unseen

```json
{
  "id": "AR0545",
  "title": "Bash builtins that set a variable without an assignment word still change git's config unseen",
  "date": "2026-10-28"
}
```

## Description

F1 of AR0524 (spec/features/AR0524-the-worktree-guard-refuses-git-config-git-commit-but-lets-export-git-config-git/findings.md).

- Kind: security
- Found by: 2026-10-28-worker-bd3b91f9 (worker), 2026-10-28
- Where: `packages/core/src/worktree-guard.ts:101`
- What: the guard now counts `GIT_CONFIG*`, `HOME` and `XDG_CONFIG_HOME` set earlier in the call by an assignment, `export`, `declare`, `typeset`, `readonly` or `local`. Bash sets a variable in other ways too, and `HOME` is always exported, so the new value reaches git: `for HOME in /tmp/h; do git status; done` and `read HOME <<< /tmp/h; git status` both pass `worktreeRefusal` (each added for a moment to the AR0524 test's refused list, which then failed on it). `printf -v`, `mapfile`/`readarray`, `getopts` and `source` of a file that sets them are the same kind [INFERENCE: not run].
- Suggestion: count any of these that names `GIT_CONFIG*`, `HOME` or `XDG_CONFIG_HOME` as an operand (`for <name> in`, `read`, `printf -v`, `mapfile`, `readarray`, `getopts`) as set for every later git call; `source` and `.` stay out of reach (a file read at run time), as `GIT_DIR` exported before already is.

## Goal

AR0524 made the worktree guard count `GIT_CONFIG_*`, `HOME` and `XDG_CONFIG_HOME` set earlier in a bash call by an assignment or by `export`, `declare`, `typeset`, `readonly` or `local`. Bash sets a variable in other ways, and each of these still reaches git unseen (each passes `worktreeRefusal`, from F1 and F2 of AR0524): `for HOME in /tmp/h; do git status; done`, `read HOME <<< /tmp/h; git status`, `let HOME=5`, `declare -n r=HOME; r=/tmp/h`, `: ${GIT_CONFIG_COUNT:=1}; export GIT_CONFIG_COUNT`, and a name built at run time, `x=HOME; export $x=/tmp/h; git status`.

- Kind: security

## Done means

- A git call after any of these, in the same bash call, gets the same refusal as `HOME=x git status`: `for <name> in`, `read`, `printf -v`, `mapfile`, `readarray`, `getopts`, `let`, a nameref (`declare -n`) to one of the names, a `${name:=value}` or `${name=value}` expansion, and an assignment builtin whose name part is not a literal word.
- `packages/core/test/worktree-guard.test.ts` has a refused row for each form above, and a passing row for the same forms on an unrelated name (`for x in a; do git status; done`); each refused row fails when its check is removed.
- `npm run check` and `npm test` pass.

## Scope

In:
- `packages/core/src/worktree-guard.ts`: count these forms in `configured`.
- `packages/core/test/worktree-guard.test.ts`: the rows above.

Out:
- `source` and `.` of a file: read at run time, out of the guard's reach.
- Function bodies and traps judged before a later export: AR0546.

## Decisions

- 2026-10-28: Source: F1 of AR0524
