# AR0634 - Review 1

- Job: 2026-11-06-review-c8d55e80
- Branch: arthur/2026-11-06-worker-907f43d7
- Commit reviewed: 5085ad55004561d6d609ab4e5694009c0e596dda
- Verdict: PASS

## Final message

I found nothing that blocks the merge. The generated roadmap page now shows "The switch, and the rest of the first version: 4 of 7 built", with 81, 102, 89 and 90 built and 70 to 72 not started.

Each Done means point holds:
- **How an entry finds its ticket:** each entry can now have a `- Tickets:` line in `spec/roadmap.md`, which `site/scripts/roadmap.ts` reads. That file is allowed by the Scope, and the worker said why this was the smaller change. A ticket titled `Roadmap <N>:` still counts.
- **Tickets named:** entries 81 (AR0550), 102 (AR0551), 89 (AR0592), 90 (AR0602, AR0606) and 103 (AR0589, AR0590, AR0593). The board has all of them as `merged`. Docker's AR0604 is still `planned`, so 70 to 72 correctly have no ticket.
- **Other sections:** every section's count is checked. Entry 103 was the one other miscount, now fixed, and Projects shows 6 of 6. Later shows 0 of 14, and every other section shows all of its entries built.
- **README Status:** main on 2026-11-05, Discord as the channel with Telegram still available, and "Next" naming Docker 70 to 72 and dokploy's upload and deploy, then 85 to 88. The Features list is unchanged and matches the board: discord, listen and video built, dokploy partly built (upload and deploy planned), docker planned (line 55).
- **Refusals:** a Tickets line that holds something other than a ticket id, or names a ticket the board does not have, fails the build. Each error names the file line and the entry.
- **Unchanged content:** the roadmap's entries and their order are untouched; the diff only adds `- Tickets:` lines and one line explaining the key.

## Notes
- (minor) `site/scripts/roadmap.ts:25`: a `- Tickets:` line in a section's text after an entry, before the next `###`, is counted for that entry. No such line exists now.
- (minor) `spec/roadmap.md:13`, `spec/roadmap.md:836`: the Order paragraph ("runs itself on Telegram first") and line 836 ("with Telegram as its channel") still say Telegram. Changing them is outside the ticket, because its Scope keeps the roadmap's content unchanged.

## Checks (all on `5085ad55`)
- **`npm run check && npm test`:** `tsc` passed, but piping the tests into a filter that matched nothing hid their counts. I re-ran `npm test` alone: 1568 tests, 1504 pass, 0 fail, 64 skipped.
- **Site tests:** `node --test "test/*.test.ts"` in `site/` (its `npm test` script): 36 pass, 0 fail.
- **Generated page:** I ran the branch's generator on the repository's `spec/roadmap.md` and `spec/build.json`. The output is as described above.
- **Site build not run:** `npm run generate` printed no error. `site/node_modules` is missing in this checkout, so I did not run the full `astro build`.
- **Hand mutations:** I ran `site/test/roadmap.test.ts` after each, then restored the file with `git checkout`; the tree is clean.

  | Mutation | Failing tests |
  |---|---|
  | Section heading no longer resets the current entry | 2 |
  | Refusal of a ticket the board does not have disabled | 1 |
  | Named tickets back under "Other open tickets" | 1 |

- **`npm run mutate`:** not run, to stay within the job's budget. The changed code is in `site/`, not `packages/` [INFERENCE: mutate covers only `packages/`]; I mutated it by hand instead.

PASS