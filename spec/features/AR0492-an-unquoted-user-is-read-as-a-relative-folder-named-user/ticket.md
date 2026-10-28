# AR0492 - An unquoted `~user` is read as a relative folder named `~user`

```json
{
  "id": "AR0492",
  "title": "An unquoted `~user` is read as a relative folder named `~user`",
  "date": "2026-10-27"
}
```

## Description

F2 of AR0471 (spec/features/AR0471-other-operators-of-pwd-and-of-the-known-variables-read-as-nothing/findings.md).

- Kind: security
- Found by: 2026-10-27-worker-c28e3457 (worker), 2026-10-27
- Where: `packages/core/src/shell-words.ts:192`
- What: the parser expands only `~`, `~+` and `~-` at a word's start; any other `~` keeps a backslash, so `~acme/arthur/README.md` is judged as a folder `~acme` under the current one. Bash expands `~user` to that user's home from the password database, so with the main checkout at `/home/acme/arthur`, `rm ~acme/arthur/README.md` writes into it. [INFERENCE] from the code at that line and bash's tilde rules; no guard test exercised it, since a test's main checkout is in a temporary folder no `~user` names. It was there before AR0471, also inside an unquoted `${x:-~user}`.
- Suggestion: refuse an unquoted `~name` at a word's start or after an assignment's `=` as a path the guard cannot tell, or expand it from `os.userInfo()`/the password database for the current user only and refuse others.

## Goal

the parser expands only `~`, `~+` and `~-` at a word's start; any other `~` keeps a backslash, so `~acme/arthur/README.md` is judged as a folder `~acme` under the current one. Bash expands `~user` to that user's home from the password database, so with the main checkout at `/home/acme/arthur`, `rm ~acme/arthur/README.md` writes into it. [INFERENCE] from the code at that line and bash's tilde rules; no guard test exercised it, since a test's main checkout is in a temporary folder no `~user` names. It was there before AR0471, also inside an unquoted `${x:-~user}`.

- Kind: security

## Done means

- The fix the finding suggests, or one that closes the same gap with less code:
  > refuse an unquoted `~name` at a word's start or after an assignment's `=` as a path the guard cannot tell, or expand it from `os.userInfo()`/the password database for the current user only and refuse others.
- A test row in `packages/core/test/worktree-guard.test.ts` for the command the Goal names, refused; it fails before the change.
- The project's checks pass.

## Scope

In:
- `packages/core/src/shell-words.ts` (at its 200-line cap: free a line or split; a core budget raise is fine).
- `packages/core/test/worktree-guard.test.ts`.

Out:
- The other gaps of the same parser: AR0491 to AR0494, each its own ticket.

## Decisions

- 2026-10-27: Source: F2 of AR0471
- 2026-10-28: Merge a ticket once its review passed, without asking the owner; pre-approved by policy (AR-D218)
