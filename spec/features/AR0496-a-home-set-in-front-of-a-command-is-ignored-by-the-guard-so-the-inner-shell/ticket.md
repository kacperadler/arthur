# AR0496 - A HOME= set in front of a command is ignored by the guard, so the inner shell reads another HOME

```json
{
  "id": "AR0496",
  "title": "A HOME= set in front of a command is ignored by the guard, so the inner shell reads another HOME",
  "date": "2026-10-27"
}
```

## Description

F2 of AR0472 (spec/features/AR0472-an-escaped-variable-in-an-unquoted-heredoc-reaches-the-inner-shell-unread-by-the/findings.md), from review 2026-10-27-review-1027b2ed.

## Goal

The worktree guard reads `$HOME` as the job's own home, also when the command line sets another one in front of the command: `HOME=../../acme bash <<EOF
rm \$HOME/README.md
EOF` and `HOME=../../acme bash -c 'rm $HOME/README.md'` pass the guard, and real bash deleted the main checkout's README in both. It was there before AR0472.

- Kind: security

## Done means

- An assignment of a known variable (`HOME`, `ARTHUR_JOB`, `PWD`, `OLDPWD`) in front of a command, or `export`ed before it in the same call, is either used as that variable's value for what the command runs, or makes the guard refuse with the unknown-path refusal; the worker picks the smaller one and says why.
- Test rows in `packages/core/test/worktree-guard.test.ts`: both commands above refused; each fails before the change.
- The project's checks pass.

## Scope

In:
- `packages/core/src/shell-words.ts` (at its 200-line cap: free a line or split; a core budget raise is fine), `packages/core/src/worktree-guard.ts` if the refusal text changes.
- `packages/core/test/worktree-guard.test.ts`.

Out:
- AR0491 to AR0494: the parser's other gaps, each its own ticket.

## Decisions

- 2026-10-27: Source: F2 of AR0472
- 2026-10-28: Merge a ticket once its review passed, without asking the owner; pre-approved by policy (AR-D218)
- 2026-10-28: AR0496 another round: refuse a declaration whose name holds an unquoted { * ? or [ before its =, review commands as tests, then review round 3; the owner: "AR-D239 1" (AR-D239)
- 2026-10-28: AR0496 another round: no index exception, every unquoted { * ? [ before the = of a declaration word is refused, then review round 4; the owner: "And go as long as this tasks will be done, today you have to focus on this fixes so do not ask me about decision for them, just go with recommendation till is done (AR-D242)" (AR-D244)
- 2026-10-28: AR0496 another round with an allow-list of plain literal names for declaration, env and sudo arguments, then review round 5; the owner: "And go as long as this tasks will be done, today you have to focus on this fixes so do not ask me about decision for them, just go with recommendation till is done (AR-D242)" (AR-D245)
- 2026-10-28: Hold AR0496 (branch kept at 09e8bd55) and go on with the queue; Q5 now waits only on AR0493; the owner: "And go as long as this tasks will be done, today you have to focus on this fixes so do not ask me about decision for them, just go with recommendation till is done (AR-D242)" (AR-D246)
- 2026-10-29: AR0496: continue its worker once more with a short instruction; the owner: "AR0496 give it one more shot, and go with this 7 fixes" (AR-D299)
- 2026-10-29: AR0496 budget raised by $5 to $22.65 so its worker finishes the allow-list round; the owner: "AR-D302 1 / AR-D303 1 / GitHub management commands - this we will do in the future, maybe after this 22 tickets and remember to create a sepparated files to each group of functionallity" (AR-D303)
