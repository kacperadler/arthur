# AR0547 - A `~` after a `:` in an assignment's value is not expanded by the parser

```json
{
  "id": "AR0547",
  "title": "A `~` after a `:` in an assignment's value is not expanded by the parser",
  "date": "2026-10-28"
}
```

## Description

F1 of AR0492 (spec/features/AR0492-an-unquoted-user-is-read-as-a-relative-folder-named-user/findings.md).

- Kind: security
- Found by: 2026-10-28-worker-6a0ef2e0 (worker), 2026-10-28
- Where: `packages/core/src/shell-words.ts:194`
- What: bash expands a tilde prefix after each unquoted `:` of an assignment's value too, also in an assignment-like argument: `bash -c 'x=a:~root/y; echo $x; echo PATH=a:~/b'` prints `a:/root/y` and `PATH=a:/home/<user>/b`. The parser expands or refuses a `~` only at a word's start or right after the `=`, so `x=a:~/b` keeps `\~`. [INFERENCE] the guard reads an assignment's value as one path, which a `:`-joined list is not, so no write through it was found; a variable such a list feeds (`CDPATH=a:~acme` before a `cd`) could still lead elsewhere.
- Suggestion: treat a `~` after an unquoted `:` in an assignment-like word as at a word's start: `~` the home, `~name` and the other prefixes `\0-`.

## Goal

Bash expands a `~` after each unquoted `:` of an assignment's value, as at a word's start: `bash -c 'x=a:~root/y; echo $x'` prints `a:/root/y` (F1 of AR0492, confirmed by its reviewer). The worktree guard's parser expands or refuses a `~` only at a word's start or right after the `=` (`packages/core/src/shell-words.ts:194`), so `x=a:~acme/y` keeps a literal `~`, and a variable such a list feeds (`CDPATH=a:~acme` before a `cd`) may lead outside the worktree unseen.

- Kind: security

## Done means

- In an assignment, or an assignment-like argument, a `~` right after an unquoted `:` is read as at a word's start: `~` and `~/x` become the job's home, `~name`, `~1` and `~+1` become the "cannot tell" marker; a quoted or escaped `~` after `:` stays literal.
- `packages/core/test/worktree-guard.test.ts` has a refused row with `x=a:~acme/y` leading to a write, and a passing row with a quoted `x=a:'~acme'/y`; the refused row fails when the change is removed.
- `npm run check` and `npm test` pass; `shell-words.ts` stays within its line limit.

## Scope

In:
- `packages/core/src/shell-words.ts`: the `~` after `:` in an assignment's value.
- `packages/core/test/worktree-guard.test.ts`: the rows above.

Out:
- Brace lists over several folders: the guard's documented limit.

## Decisions

- 2026-10-28: Source: F1 of AR0492
