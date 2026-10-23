# AR0287 - Review 1

- Job: 2026-10-22-review-ar0287-c3587d3b
- Branch: h/2026-10-22-ar0287-490bd629
- Commit reviewed: b953bd87e7f8ed949f7499ca762c3ff2667da0b3
- Verdict: PASS

## Final message

All ticket requirements met, Decisions honored exactly, merge correct, checks pass.

**Verification**

- `npm ci`: clean install.
- `npm run check`: clean (tsc, no errors).
- `npm test`: 1029/1029 pass, matches worker's claim.
- Budget numbers: `wc -l packages/{orchestration,delivery,develop}/src/*.ts` → 2278, 1285, 669 — exactly matching both the ticket's Decision (raises accepted "after merging main") and the worker's final message.
- `structure.test.ts`: every prior budget comment preserved (AR0274, AR0285, AR0283's merge note, AR0288, etc.), new AR0287 comment appended, new merge-note appended — matches "keep every budget comment" instruction.
- Merge conflict resolution in `inbox.test.ts` (`NOT_YET` from main kept, followed by this branch's procedure-line assertion) and in `structure.test.ts` verified by reading the merged file directly, not just trusting the message.

**Mutation checks (all caught by existing tests, then reverted with `git checkout --`)**

1. Disabled the `records.delivery` shape validation in `delivery.ts`'s `named()` (`if (false)` instead of the regex checks) → `review.test.ts`'s "wrong" cases test failed to throw. Confirms the validation is exercised, not decorative.
2. Removed the `job.state === "ended" && job.reason === "finished"` guard before computing verdict in `named()` → same test's "a run that did not finish has none" assertion failed (wrongly produced a PASS line). Confirms the state/reason gate is real.
3. Removed the `host.jobs.list().some(...)` guard in `onboarding.ts` before `writeOnce` → the "eval's job... writes nothing" test failed (`nothing written in the home` assertion caught `true !== false`). Confirms the no-home write-suppression is tested, not assumed.
4. Reverted `inbox.ts` to pass only `job` (not `job, message`) to `coordinator.wake` providers → two `inbox.test.ts` tests failed (both tests asserting the final message reaches providers). Confirms the plumbing of the final message to providers is covered.

**Boundary / styleguide**

- No cross-plugin imports added; `delivery.ts` only imports its own package's `review-records.ts`.
- No runtime deps, no classes/enums, all files well under the 200-line budget (delivery.ts 166, inbox.ts 185, onboarding.ts 82, eval-scenario.ts 113).
- Docs (`plugin-api.md`, `review.md`, `eval.md`, `coordinator.md`, `init.md`) updated consistently with the behavior change.
- `needs` arrays dropped from the four named eval scenarios exactly as Done means required, with `records.delivery` fixtures added where the provider needs data not in the final message (delivery), and left out where the final message alone suffices (onboarding).

**Notes (non-blocking)**

- None beyond scope; diff stays within the ticket + the explicitly requested main-merge.

PASS
