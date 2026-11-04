# AR0617 - Review 1

- Job: 2026-11-04-review-0dc4a3d9
- Branch: arthur/2026-11-04-worker-cb7707c9
- Commit reviewed: 916a5c81becad1dadd94270f981d884407895d99
- Verdict: PASS

## Final message

I found nothing that blocks the merge. The branch does what AR0617 asks: unquoted brace lists and sequences are expanded before the worktree guard judges paths, `-C` folders and redirect targets. Quoted or escaped lists stay one word, and the new rows cover a list in a path, in `-C`, nested and quoted.

**Lists over 256 words:** refusing them as unknown is right, and the tests pin the limit on both sides. `touch x{1..256}` passes, `touch x{1..257}` is unknown, and so is `rm ../../{x,…257,acme}/README.md`. If an over-limit word were kept whole, as the env guard keeps it, a 257-part list naming `acme` would get past the worktree guard. The ticket lets a sequence be "refused as unknown or expanded", so expanding up to 256 and refusing beyond is within scope. The cost is that harmless commands like `echo {1..1000}` are now refused. I confirmed that: `expanded` turns that word into `\0`.

**The ticket's git example:** the worker is right that it does not commit. In a throwaway repo, `bash -c 'git -C ../../{acme,x} commit --allow-empty -m x'` printed `git: '../../x' is not a git command`, exited 1, and `git log` in `acme` showed no commits. The forms that would commit in main are in the tests and expected to be refused: `git -C {../../acme,commit} -m x`, `git {-C,../../acme} commit -m x` and `git -C ../../ac{m..m}e commit -m x`.

**Other ways around it:** I ran parsed commands through `expanded` and none of these got past:
- a quoted part inside a list (`{ac"me",x}`, `{acme,"x y"}`);
- a list next to `${x}`, `$(…)` or backquotes (the `acme` word is still produced, the others marked as known only at run time);
- doubled lists (`{,}{acme,x}`);
- a step of `-1` or `+1` (`ac{m..m..-1}e`);
- a quoted tail (`{acme,x}"/README.md"`).

A list inside `$'…'` stays one word, as bash leaves it.

**Budget and file size:** the core budget raise from 7163 to 7198 is covered by the owner's standing decision AR-D63. `bash-refusal.ts` goes from 208 to 210 lines and stays yellow; the worker says why.

## Notes
- (risk) packages/core/src/shell-braces.ts:7: harmless large lists are now refused. Any command whose brace lists make more than 256 words is refused as unknown, read-only ones like `for i in {1..1000}` included. This is a deliberate trade-off and the refusal message names it.
- (minor) packages/core/src/shell-braces.ts:32: the comment above `expanded` is one 241-character line, so it counts as 2 lines toward the budget.

## Checks (all on 916a5c81)
- `npm run check && npm test` (timeout 1800): tsc clean; 1537 tests, 1473 pass, 0 fail, 64 skipped.
- The git claim, checked with real bash and git in a temporary folder: exit 1, no commit in `acme`.
- Ways around the guard, checked with throwaway `node -e` calls through `shellCommands` and `expanded`: every case expanded as bash would, and none got past.
- I did not run `npm run mutate` or any hand mutations, to keep within the small budget.

PASS