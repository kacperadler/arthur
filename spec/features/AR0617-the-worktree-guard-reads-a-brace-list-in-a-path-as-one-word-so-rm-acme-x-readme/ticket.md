# AR0617 - The worktree guard reads a brace list in a path as one word, so rm ../../{acme,x}/README.md reaches the main checkout

```json
{
  "id": "AR0617",
  "title": "The worktree guard reads a brace list in a path as one word, so rm ../../{acme,x}/README.md reaches the main checkout",
  "date": "2026-11-03"
}
```

## Description

The worktree guard judges each shell word as one path, but bash expands an unquoted brace list into several. So `rm ../../{acme,x}/README.md`, run from a job's worktree, deletes the main checkout's file, and `git -C ../../{acme,x} commit` commits there, both past the guard. This makes the guard judge every word bash makes from a brace list.

## Goal

Finding F3 of AR0396 (`npx arthur findings AR0396`): through `worktreeRefusal` in a job of a temporary project `acme`, `rm ../../{acme,x}/README.md` and `git -C ../../{acme,x} commit -m x` passed, though bash expands the first to `../../acme/README.md`. `packages/core/src/bash-refusal.ts` (`theirs`) reads each word as one path; `packages/core/src/env-refusal.ts` already expands comma brace lists (`braces`) for the env guard.

- Kind: security

## Done means

- Unquoted comma brace lists are expanded where the guard splits shell words, so every path, `-C` folder and refspec it judges is each word bash makes; a quoted list stays one word, as in bash.
- Rows in `packages/core/test/worktree-guard.test.ts`: a list in the folder part of a path, in `-C`, nested, and quoted (passes): they fail when the expansion is removed.
- A sequence (`{a..z}`) is refused as unknown or expanded, and a test shows which.
- `npm run check` and `npm test` pass.

## Scope

In:
- `packages/core/src/shell-words.ts` or `packages/core/src/bash-refusal.ts`: the expansion, reusing the behaviour of `env-refusal.ts`'s `braces` rather than a second copy where the files allow.
- `packages/core/test/worktree-guard.test.ts`: the rows above.

Out:
- Refspecs from config (AR0615) and `git fast-import` (AR0616).

## Decisions

