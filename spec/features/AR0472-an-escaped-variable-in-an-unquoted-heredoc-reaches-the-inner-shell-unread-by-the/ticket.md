# AR0472 - An escaped variable in an unquoted heredoc reaches the inner shell unread by the guard

```json
{
  "id": "AR0472",
  "title": "An escaped variable in an unquoted heredoc reaches the inner shell unread by the guard",
  "date": "2026-10-27"
}
```

## Description

A job can still write into a guarded place through an escaped variable in an unquoted heredoc: the outer shell drops the backslash and the inner shell expands the variable, but the worktree guard reads it as literal text.

## Goal

Source: note 1 of AR0429's review-2, confirmed with real bash: `bash <<EOF` / `echo x > \$ARTHUR_JOB/result` / `EOF` passes the guard, and so does `\$HOME/acme/README.md`; the code before AR0429 let the `\$HOME` form through too. `packages/core/src/shell-words.ts` (heredoc body).

- Kind: security

## Done means

- Both forms are refused naming the guarded place; rows in `packages/core/test/worktree-guard.test.ts` that fail without the fix.

## Scope

In:
- `packages/core/src/shell-words.ts`, `packages/core/test/worktree-guard.test.ts`.

Out:
- Other guard forms: AR0471.

## Decisions

- 2026-10-27: Source: F2 of AR0429
