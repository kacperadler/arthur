# AR0352 - Review 1

- Job: 2026-10-25-review-c1bf47ac
- Branch: arthur/2026-10-25-worker-82dd54ce
- Commit reviewed: cf7dccfac3551beaf2ec0a036cc18cf0741fcaee
- Verdict: PASS

## Final message

No blocking findings. The branch does what AR0352 asks.

**Findings**

None.

- `packages/delivery/src/delivery-options.ts:16`: `ALWAYS_REVIEW` gains `.agents/**/roles/reviewer.md` and `.agents/**/criteria/review.md`. This is the second fix the ticket allows (explicit entries). The bare `.agents/**` was optional, tied to F3, and was left out.
- `packages/delivery/docs/commands/review-needed.md:24` now says that `**` does not enter a folder whose name starts with a dot unless the pattern names it, with the `.agents/arthur/roles/reviewer.md` example, as Done means asks.
- The tests cover what Done means names:
  - `packages/delivery/test/review-needed.test.ts:89-90`: a branch that changes only `.agents/arthur/roles/reviewer.md`, and one that changes only `.agents/arthur/criteria/review.md`. Each is answered `review: … is on the always-review list`.
  - `:171-172`: `delivery.alwaysReview` with the default list holds both paths and still leaves out `src/shop.ts` and `src/environment.ts`.
- `arthur.config.example.ts:352` adds the same two entries. The existing test that checks the example config's delivery options runs and passes.
- One commit, `fix(AR0352): …`, in Conventional Commits form with the ticket id as scope. Nothing outside the ticket's area changed.

**Notes**

- The worker's final message is only a placeholder ("Waiting for bg_1…"). It claims no check result and no behavior, so there was nothing to compare.
- I did not do mutation runs: the owner limited this review to the two commands below. From reading the code, not from a run: removing either new entry would make its row at `:89` or `:90` fail, and also the `paths.slice(0, 7)` assertion at `:172`.
- `review-needed.test.ts` is now about 206 lines. The 200-line rule covers source files; this is a test file.

**Checks run**

- `npm run check` (`tsc`): passed, no errors.
- `timeout 300 node --import @arthur/core/testing --test packages/delivery/test/review-needed.test.ts`: 7 tests, 7 pass, 0 fail.
- Not run, as the owner instructed: `npm ci` and the full `npm test`. The merge runs the full suite on main.

PASS