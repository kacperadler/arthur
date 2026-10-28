# AR0493 - A backslash-newline after $ is not removed, so the guard reads a folder name where bash reads ..

```json
{
  "id": "AR0493",
  "title": "A backslash-newline after $ is not removed, so the guard reads a folder name where bash reads ..",
  "date": "2026-10-27"
}
```

## Description

F3 of AR0471 (spec/features/AR0471-other-operators-of-pwd-and-of-the-known-variables-read-as-nothing/findings.md).

Also F1 of AR0472: a backslash-newline right before a heredoc's delimiter line makes bash read the next lines as body, while the guard reads them as outer commands (`bash <<EOF\necho a\\\nEOF\nrm \$HOME/acme/README.md\nEOF` passes the guard). The same fix covers it; add that row.

## Goal

The worktree guard's shell parser never removes a backslash-newline right after `$` (`packages/core/src/shell-words.ts:89`). So `rm "${x:-$\<newline>'..'}/../acme/README.md"` (and the same with `".."`) passes the guard, which reads a folder named `$'..'`, while bash 5.2 reads `..` and deletes the main checkout's README. Outside a fallback too, `$\<newline>HOME` reads as the text `$HOME`. Found by review 2026-10-27-review-804fd865 of AR0471; it passes on main before AR0471 as well.

- Kind: security

## Done means

- The parser removes a backslash-newline wherever bash does (outside single quotes), before reading `$`, so `$\<newline>HOME` reads as `$HOME` and the fallback's `$\<newline>'..'` is refused like `$'..'`.
- Test rows in `packages/core/test/worktree-guard.test.ts`: both commands above refused (main checkout or unknown), and `$\<newline>HOME/../acme/README.md` refused; each fails before the change.
- The project's checks pass.

## Scope

In:
- `packages/core/src/shell-words.ts` (at its 200-line cap: free a line or split, a core budget raise is fine).
- `packages/core/test/worktree-guard.test.ts`.

Out:
- AR0491 (a command substitution in a fallback), AR0492 (`~user`): their own tickets.

## Decisions

- 2026-10-27: Source: F1 of AR0472 too

- 2026-10-27: Source: F3 of AR0471
- 2026-10-28: Raise the core line budget by what the fix needs, without asking the owner; pre-approved by policy (AR-D63)
