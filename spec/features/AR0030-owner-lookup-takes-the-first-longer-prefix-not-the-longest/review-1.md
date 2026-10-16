# AR0030 - Review 1

- Job: 2026-10-16-review-ar0030-longest-pr-3f0e5e85
- Branch: h/2026-10-16-ar0030-longest-prefix-ow-d705af4f
- Commit reviewed: 595df13da306f12d3912bcbe47deca1288ee8682
- Verdict: PASS

## Final message

All verified. Findings below.

**Verification performed**

- `git diff`/`git log` on the exact range: single commit, touches only `packages/core/src/env.ts` (`nameProblem`) and `packages/core/test/env.test.ts`, +34/−2 as claimed.
- `nameProblem` logic: loop tracks the best (longest) matching prefix across all owners instead of `Array.find`'s first-longer-than-own match — correct longest-prefix-wins semantics, order-independent.
- New test covers two three-level setups (plugin `a`/instance `b`/instance `b-c`; plugins `a`/`a-b`/instance `c` of `a-b`), each run in both declaration orders, asserting both the problem messages name the deepest owner and only the deepest owner's variable is accepted. Matches ticket's Done means intent; worker's substitution for the ticket's literal example is justified — that example (`a`'s instance `b` and plugin `a-b`) both own prefix `ARTHUR_A_B_`, which the existing duplicate-prefix check already refuses, so it can't exercise the longest-prefix logic. This substitution is explicitly in Scope's "Out" (accepted by the review) and the ticket itself only gives the three-owner case as an "e.g.".
- Secret (`s3cret`) never appears in any problem message or refusal text; test asserts `assert.doesNotMatch(refusal(...), /s3cret/)` in both setups.
- `npm ci`: installs cleanly (5 packages).
- `npm run check` (`tsc`): passes, no errors.
- `npm test`: 48/48 pass, matches worker's claim; includes the two-level tests unchanged and still passing.
- Mutation: reverted `nameProblem` to the original `Array.find` first-longer-match implementation, reran `node --test packages/core/test/env.test.ts` → 15 pass, 1 fail, the new three-level test, with the exact mismatch expected (`instance b` picked instead of the deeper `instance b-c`). Matches worker's claimed before/after counts exactly. Restored the real fix via `git checkout --`, tree clean, full suite back to 48/48.
- No boundary, shape, or scope violations: no new file, no runtime dependency, no class/enum, within line budget (file unchanged in size class), change confined to the one function and its test.

No findings.

PASS
