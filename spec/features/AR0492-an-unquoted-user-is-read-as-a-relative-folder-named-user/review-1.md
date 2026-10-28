# AR0492 - Review 1

- Job: 2026-10-28-review-0ad6e27e
- Branch: arthur/2026-10-28-worker-6a0ef2e0
- Commit reviewed: df2475356bed27c3d1fc955e85210831b4d49a5e
- Verdict: PASS

## Final message

I found nothing that blocks the merge. The branch does what AR0492 asks: an unquoted `~name` at a word's start, after an assignment's `=`, or inside an unquoted `${x:-…}` fallback now becomes the "cannot tell" marker `\0-`, and the guard refuses it. `~`, `~+` and `~-` work as before.

## Findings

None.

## Notes

- **Two mutations the tests don't catch.** Removing `$` or the backtick from the name's character class in `packages/core/src/shell-words.ts:193` survives the guard test. Either change only makes the guard refuse more: `~acme$x/…` would be refused, while bash leaves it as a literal `~`. The refusal is not weakened, so I don't count it as a key-behavior miss. A row with `~acme$x/README.md` (expected to pass) would pin it.
- **Change outside the ticket's In list.** The new clause in the refusal message (`packages/core/src/worktree-guard.ts:30`) is not in the ticket's list of files to change. The final message says why: otherwise the refusal wouldn't explain itself. The test's copy of the message matches it.
- **Brace lists still get through.** `rm {x,~acme}/README.md` parses as the literal `{x,\~acme}/…`, but bash expands it to `/home/acme/…`. The same is true for plain `{x,~}` before this branch. AR0320's check, row 60, already records brace lists over several folders as a documented limit, so it is not part of this ticket.
- **F1 is accurate.** The worker logged F1 in the ticket's `findings.md`: bash also expands a `~` after `:` in an assignment's value. I confirmed it with `bash -c 'x=a:~root/y; echo $x'`, which prints `a:/root/y`. It is left open.
- **Size limit.** `shell-words.ts` is exactly 200 lines, at the limit and not over it.
- **The worker's claims hold up.** The ticket's Done means is met: the Goal's command `rm ~acme/arthur/README.md` has a refused test row, and that row fails without the fix (mutation below). The test counts and the claim that each new condition is caught match what I saw.

## Checks run

- **`npm ci`:** exit 0.
- **`npm run check && npm test`, two full runs:** the first was moved to the background and its result came back later; the second wrote to a log file in the worktree, since deleted. Both: `tsc` reported no errors; `ℹ tests 1229`, `ℹ pass 1168`, `ℹ fail 0`, `ℹ skipped 61`; test exit 0.
- **Parser probe:** I called `shellCommands` with `HOME=/home/h`.
  - Refused (`\0-`): `~acme`, `~acme/…`, `~acme` followed by a newline, `~{acme,x}/…`, `x=(~acme/a)`, `export x=~acme/a`, `rm a=~acme/a`, `${x:=~acme}`, `${x+~acme}`, `${x-~acme}`, `${x:-~acme/a}`, `cd ~acme/arthur`, `~-1/a`.
  - Unchanged: `~/a` became `/home/h/a`; `~+/a` and `~-/a` stayed as written.
  - Bash itself gives the same readings: `~root"x"/y` and `~$USER/y` stay literal.
- **Mutations:** run on a throwaway copy of `packages/core`, inside the worktree and since deleted, against the guard's main table test.

| Mutation | Result |
|---|---|
| `\0-` back to the old literal `\\~` | caught (`rm ~acme/arthur/README.md: undefined`) |
| drop the `~-` exception | caught |
| drop the `~+` exception | caught |
| drop `'` from the name class | caught |
| drop `"` from the name class | caught |
| drop `\` from the name class | caught |
| no `~name` handling after an assignment's `=` | caught |
| digits not counted as a name (`~1`) | caught |
| drop `$` from the name class | survived (only refuses more) |
| drop the backtick from the name class | survived (only refuses more) |

- **Clean tree:** I restored the copy and deleted it with the log; `git status --short` is empty.

PASS