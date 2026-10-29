# AR0546 - A function body or a trap is judged before a later export, and the `function f { }` form is not parsed at all

```json
{
  "id": "AR0546",
  "title": "A function body or a trap is judged before a later export, and the `function f { }` form is not parsed at all",
  "date": "2026-10-28"
}
```

## Description

F3 of AR0524 (spec/features/AR0524-the-worktree-guard-refuses-git-config-git-commit-but-lets-export-git-config-git/findings.md), from the review of AR0524. A job could change git config through a function or a trap, or write into the main checkout through a `function f { }` body, past the worktree guard.

## Goal

The worktree guard judges a function body where it is defined, before an `export` later in the same bash call is counted, and the `function f { }` keyword form is not parsed at all (F3 of AR0524; each passes `worktreeRefusal`):
- `f() { git c a.c d; }; export GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=alias.c GIT_CONFIG_VALUE_0=config; f`
- `cd() { git status; }; export HOME=/tmp/h; cd .`
- `trap "git status" EXIT; export HOME=/tmp/h`
- `function f { rm -rf <main>/x; }; f`, which writes into the main checkout.

- Kind: security

## Done means

- Each command above is refused: a function body and a trap's command are judged with every config assignment of the whole call counted, and a `function f { ... }` or `function f() { ... }` body is judged as the `f() { ... }` form is.
- `packages/core/test/worktree-guard.test.ts` has a refused row for each, and a passing row for a function that runs only a harmless command; each refused row fails when its fix is removed.
- `npm run check` and `npm test` pass.

## Scope

In:
- `packages/core/src/worktree-guard.ts`: judge function bodies and traps after the call's assignments are known; parse the `function` keyword.
- `packages/core/src/shell-words.ts`, if the keyword form needs the parser.
- `packages/core/test/worktree-guard.test.ts`: the rows above.

Out:
- Other ways to set a variable (`read`, `for`, `let`, a nameref): AR0545.

## Decisions

- 2026-10-28: Source: F3 of AR0524
- 2026-10-29: AR0546: a git call in a bash call that sets git config anywhere is refused, as HOME already is; the owner: "Idz z wszystkich rekomendacjow i nie pytaj mnie (AR-D271, voice note)" (AR-D322)
- 2026-10-29: AR0546: core line budget 6460 -> 6467; the owner: "Idz z wszystkich rekomendacjow i nie pytaj mnie (AR-D271, voice note)" (AR-D321)
