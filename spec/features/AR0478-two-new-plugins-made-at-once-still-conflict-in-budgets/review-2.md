# AR0478 - Review 2

- Job: 2026-10-28-review-23b8ed3a
- Branch: arthur/2026-10-28-worker-6ece3b9a
- Commit reviewed: 339b689548b8acdec82a521df94e6be339f5b2a4
- Verdict: PASS

## Final message

No blocking findings. All three findings from review 1 are fixed, the checks pass, and every mutation I tried was caught.

## Findings
None.

## Notes
- **Owner action:** the one-time sort of `BUDGETS` in `test/structure.test.ts` goes beyond the ticket's Scope "In", and the ticket's Decisions don't record it. It comes from review 1's first suggested fix, which the continue message passed on. The worker's message gives that reason and asks for the decision to be recorded from main. The form the ticket keeps out of scope is unchanged: one budget per line, a blank line after each.
- **The budgets themselves are unchanged.** Apart from the order, the only difference from the base is `develop` going from 706 to 710, which the owner's AR-D225 line on main covers.
- **The ticket's Goal is only partly met.** Two new plugins still conflict when no existing budget's name sorts between theirs. A plain text merge can't avoid that, and `packages/develop/docs/commands/plugin.md:30` now states the condition correctly. "Done means" asks for one clean pair, and the test merges 10 pairs.
- **Open branches may conflict once.** As the worker says, an open branch that raises a budget may hit one conflict in `BUDGETS` when this sort lands.
- **Comment style:** the comment above `BUDGETS` in `test/structure.test.ts:9-10` now runs over two lines. This is wording only.
- **Ticket file:** the worker's message says it removed its Worker line from the ticket. The range doesn't touch the ticket in the end, which matches.

## Checks run
- **`npm ci`:** added 22 packages.
- **`npm run check`:** `tsc` clean, exit 0.
- **`npm test`:** the foreground run was moved to the background, so I ran it again with its output to a file in my worktree, then deleted the file. Both runs gave 1227 tests, 1166 pass, 0 fail, 61 skipped, exit 0. This matches the worker's numbers.
- **Mutations:** each was run against `packages/develop/test/plugin-new.test.ts` and `test/structure.test.ts`, then restored with `git checkout`. `git status --porcelain` was empty afterwards.

  | Mutation | Result |
  |---|---|
  | Regex without `"?` (uncaught in review 1) | 4 fail, caught |
  | Fallback `entries.length` changed to `0` | 1 fail, caught |
  | `> name` changed to `< name` | 4 fail, caught |
  | Old behaviour restored: new budget always added last | 4 fail, caught |
  | `nvm` and `orchestration` swapped in `BUDGETS` | 1 fail, "BUDGETS in name order", caught |

- **Extra merge pairs:** I ran the branch's insertion code on a copy of the sorted file in a temp folder, then `git merge-file -p` on each pair. The temp folder is removed. Every result matches the doc's condition.

  | Pair | Where they land | Exit |
  |---|---|---|
  | `cz` + `delta` | one budget apart | 0 |
  | `x` + `zeta` | `zeta` goes last | 0 |
  | `core-x` + `commit` | different places | 0 |
  | `a-b` + `abc` | same place | 1 |
  | `abc` + `commit` | same place | 1 |
  | `core-testing` + `core-x` | same place | 1 |

- **Other checks:** `plugin-new.ts` is 144 lines, and the develop budget of 710 holds in the structure test.

PASS