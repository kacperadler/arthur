# AR0475 - Review 1

- Job: 2026-10-27-review-3f8f193a
- Branch: arthur/2026-10-27-worker-042433a0
- Commit reviewed: 99c6e61472ae41820a0879a0140f026b1ba8becd
- Verdict: PASS

## Final message

I found nothing that blocks the merge. `BUDGETS` in `test/structure.test.ts` now holds one budget per line, the 761-line raise log is gone, and the 19 numbers are the same as at base 2a544411. `arthur plugin new` reads and writes the new form, and its tests catch every mutation I tried.

## Findings

None.

## Notes (non-blocking)

- **Blank line after each budget:** that is the owner's accepted decision AR-D143, recorded in the ticket's Decisions, so it is not a finding.
- **Line count in the worker's message:** "998 to 257 lines" is true of commit 299d3427. After f7d19263 adds the blank lines and the comment line, the file is 277 lines.
- **Strict form for the budgets block:** `packages/develop/src/plugin-new.ts:16` only accepts budget lines that end with `,` and are followed by a blank line. A hand-added budget with a trailing comment (`core: 6345, // why`) makes the command refuse with the message "holds 0 blocks …", which names the expected form. That is a clear refusal, not lost work.
- **Out-of-date template:** the job task template still says to record a budget raise in `test/structure.test.ts`. The worker reported it, and it lives outside this range.
- **Finding F1 (open):** two branches that each run `arthur plugin new` both add their budget at the end, so they still conflict. It is recorded honestly in `findings.md`.

## Checks I ran

As you asked, I did not run the full suite or `npm ci`; I used the `node_modules` already in this checkout.

- **`npm run check`:** exit 0.
- **The two changed test files** (`node --import @arthur/core/testing --test test/structure.test.ts packages/develop/test/plugin-new.test.ts`): 22 tests, 22 pass, 0 fail, 0 skipped. This matches the worker's claim.
- **Budget numbers:** compared base against the branch, and all 19 values are unchanged. The `develop` package's `src/` holds 706 lines, exactly its budget.
- **Mutations** on `packages/develop/src/plugin-new.ts`, each run against `plugin-new.test.ts` and restored with `git checkout --` (`git status` is clean afterwards):

| Mutation | Result |
|---|---|
| A. `^\t` anchor dropped from the "already has a budget" check | caught: 1 fail |
| B. `found.length !== 1` changed to `> 1`, so a file with no block is accepted | caught: 1 fail |
| C. New budget inserted first instead of last | caught: 3 fail |
| D. Blank line made optional in the `BUDGETS` pattern | caught: 1 fail |

- **Full `npm test` on the host** (the coordinator's result): 1195 tests, 1189 pass, 0 fail, 6 skipped, the expected 6.

PASS