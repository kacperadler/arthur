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

Refusal, not emulation (as AR-D157 chose for AR0471): three review rounds of a second parser that joins lines as bash does (branch arthur/2026-10-28-worker-86ff30bd, dropped) each opened a new place where it and the guard's parser disagree (review-1.md to review-3.md). This ticket does not join lines in a second pass.

- A bash call holding a backslash-newline whose preceding character is not a blank (a space or a tab) is refused with the existing "cannot tell" (unknown) refusal, checked once on the raw command text before it is parsed, wherever it stands (quotes, `${...}`, a heredoc and its delimiter included). A backslash-newline after a blank, the usual line continuation between words, is read as today.
- Refused rows in `packages/core/test/worktree-guard.test.ts`: both Goal commands, `rm $\<newline>HOME/acme/README.md`, `<<\<newline>EOF` and the AR0472 heredoc row, and every command of review-1.md to review-3.md of this ticket that ends in a write to the main checkout; each fails before the change. A passing row: a long command split with ` \<newline>` between words.
- `docs/deploy.md`'s guard paragraph names the refusal.
- The project's checks pass.

## Scope

In:
- `packages/core/src/worktree-guard.ts` or `packages/core/src/shell-words.ts`: the one check (each at its 200-line cap: free a line, a core budget raise is fine).
- `packages/core/test/worktree-guard.test.ts`, `docs/deploy.md`.

Out:
- AR0491 (a command substitution in a fallback), AR0492 (`~user`): their own tickets.
- A second pass that joins lines as bash does: dropped with the old branch.

## Decisions

- 2026-10-27: Source: F1 of AR0472 too

- 2026-10-27: Source: F3 of AR0471
- 2026-10-28: Raise the core line budget by what the fix needs, without asking the owner; pre-approved by policy (AR-D63)
- 2026-10-28: Raise the core line budget by what the fix needs, without asking the owner; pre-approved by policy (AR-D63)
- 2026-10-28: AR0493 another round: joinLines follows ${...} outside quotes as it does inside double quotes, the review rows as tests, then review round 3; the owner: "AR-D238 1" (AR-D238)
- 2026-10-28: Raise the core line budget by what the fix needs, without asking the owner; pre-approved by policy (AR-D63)
- 2026-10-28: AR0493: fix the ticket to refuse a backslash-newline not after a blank, drop the joining branch, new worker from main; the owner: "And go as long as this tasks will be done, today you have to focus on this fixes so do not ask me about decision for them, just go with recommendation till is done (AR-D242)" (AR-D243)
- 2026-10-28: Merge a ticket once its review passed, without asking the owner; pre-approved by policy (AR-D218)
