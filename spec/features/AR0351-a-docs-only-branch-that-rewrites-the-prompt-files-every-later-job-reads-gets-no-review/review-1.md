# AR0351 - Review 1

- Job: 2026-10-25-review-d1705291
- Branch: arthur/2026-10-25-worker-0333b032
- Commit reviewed: 00a08c02b2a419ebec13ae82441fd8f19017a8d6
- Verdict: PASS

## Final message

No findings: the branch does what AR0351 asks. A docs-only branch that changes a prompt file the roles read now gets `review: <path> is on the always-review list`, and a README still counts as docs.

**What the branch does**
- `packages/delivery/src/delivery-options.ts:16`: the four reviewer-only patterns are replaced by `**/roles/**`, `**/criteria/**`, `.agents/**` and `spec/vision.md`, the patterns the ticket names. The file is 39 lines.
- The list is still checked before the docs-only rule (`review-needed.ts:59-60`, then `:67`), so nothing else in the source had to change.
- Every test the ticket's Done means asks for is there:
  - table rows in `review-needed.test.ts` for a branch that changes only `.agents/arthur/roles/worker.md` and one that changes only `spec/vision.md`, plus styleguide, coordinator procedure and `prompts/criteria` rows;
  - `delivery.alwaysReview` answering the prompt paths and leaving out `README.md`, `docs/vision.md`, `spec/roadmap.md` and `roles.ts`;
  - `autopilot.test.ts` refusing a ticket whose Scope names one of four prompt files.
- The autopilot test uses a fake delivery, as the styleguide requires, so it does not test delivery's real list. The `review-needed` tests cover that list.
- The doc page, `README.md:45` and `arthur.config.example.ts` are updated to match.
- The rest of the range, AR0341's code and docs, came in through the merge of main, not from this worker.

**Notes (not blocking)**
- I checked the glob behaviour with `path.matchesGlob`:
  - `**/roles/**` does not match `.agents/arthur/roles/worker.md`, because `**` skips dot folders, but `.agents/**` does.
  - `roles/worker.md` at the root and `prompts/criteria/a.md` match.
  - A `.agents/` folder nested inside a package does not match. That does not matter: the core reads `.agents/arthur/…` from the repository root only.
- As the worker says, a project that moves its prompt files with `prompts.vision`, or to a folder not named `roles/` or `criteria/`, is not covered unless it adds those paths to `review.alwaysReview`. The ticket chose these patterns.
- The worker's copy in `/tmp` was deleted and is not in any commit.

**Checks I ran**
- `npm ci`: 22 packages added.
- `npm run check` (`tsc`): no errors.
- `npm test`: 1121 tests, 1063 pass, 0 fail, 58 skipped.
- Mutations, each restored with `git checkout --`:

| Mutation | Result |
|---|---|
| Remove `".agents/**"` from `ALWAYS_REVIEW` | 2 tests fail in `review-needed.test.ts` (table of branches, always-review list) |
| Remove `"spec/vision.md"` | same 2 fail |
| Remove `"**/roles/**"` | same 2 fail |
| Remove `"**/criteria/**"` | same 2 fail |
| Move the docs-only rule above the list check in `review-needed.ts` | same 2 fail |
| Make `autopilot.ts:106` refuse only when more than 9 paths are on the list (`held.length > 9`) | the autopilot "refused, each naming the rule broken" test fails |

- The worker's claim of 17 of 17 passing for the two test files fits the counts I saw: 7 tests in `review-needed.test.ts` and 10 in `autopilot.test.ts`.

PASS