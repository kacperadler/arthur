# AR0255 - Review 1

- Job: 2026-10-21-review-ar0255-clock-skew-cb66a04f
- Branch: h/2026-10-21-ar0255-clock-skew-margin-7420eaea
- Commit reviewed: feffc212fca1b848d01b9d04c883d95b0b7bdb65
- Verdict: PASS

## Final message

## Review: AR0255 — poll time from GitHub's `date` header

### Findings
None that block merge.

### Verification performed

**Code read**: `github-api.ts` (`ask` now returns `date` header via `response.headers.get("date")`, additive optional field, no change to existing error paths), `github-pulls.ts` (`polled` = `said - (Date.now()-asked)` rounded down to the second, falling back to `asked` when `Date.parse(listed.date ?? "")` is `NaN`), `fake-github.ts` (`clock`/`slow` knobs, `sendDate=false` + explicit header so the fake can suppress or offset the header realistically), new test in `github.test.ts`, `docs/github.md`, `structure.test.ts` budget bump, ticket Decision line.

- `npm ci`, `npm run check`: clean.
- `npm test` (full suite, background job, ~279s): **923/923 pass**, matches worker's claim exactly.
- `node --test --test-name-pattern="a poll's time is GitHub's"`: new test passes standalone.
- Line-budget claim verified: `cat packages/github/src/*.ts | wc -l` → 625, matches `BUDGETS.github` and main's ticket Decision ("github budget 621 to 625"). Per-file 200-line cap only applies to `src/` (confirmed in `test/structure.ts`: `if (path.split(sep)[0] !== "src") continue;`), so `github.test.ts` growing to 538 lines is not a violation.
- **Mutation testing** (own edits, reverted each time, `git status --short` clean after restore):
  1. Reverted `polled` to pure `Date.now()` → test fails, times out waiting for review 80 (clock-behind scenario). Matches worker's claim.
  2. Removed the `- (Date.now()-asked)` subtraction (kept `said` alone) → test fails, times out waiting for review 90 (in-flight slow-answer scenario). Matches.
  3. Removed the `Number.isFinite(said)` fallback (always used `said`, which is `NaN` without a header) → test fails, times out waiting for review 100 (no-`date` scenario). Matches.
  4. Added a fixed extra 120s margin on top of the existing subtraction → test fails on `review 81 … is not told` assertion (rejects a silent fixed-margin add). Matches.
- Confirmed `box.errors` assertion (`[told(), box.errors] === [[80,90,100], []]`) exercises the no-`date` fallback path silently, no stderr line — matches worker's claim.
- `fakeGithub`'s new default (`state.clock` undefined ⇒ `??0`) now sends a `date` header on every response by default, mimicking real GitHub; full-suite green confirms this doesn't destabilize pre-existing tests.

### Compliance with ticket / plan
- Ticket's Done means: "take the poll's time from the `date` header of GitHub's answer to the list… so both times are GitHub's" — implemented exactly, `ask` surfaces `date`, `newReviews` consumes it.
- Worker's deviation (subtracting the request's own duration, no fixed margin) is explicitly called out in the final message and is already recorded in main's ticket Decisions: "Coordinator (free hand) accepted the worker pick… instead of a fixed margin; github budget 621 to 625" — matches the worker's own `+4` note. No undisclosed scope creep.
- `docs/github.md` updated to describe the new clock source and fallback.
- No boundary violations: changes confined to `packages/github/{src,test,docs}`, root `test/structure.test.ts` (budget table, permitted), and the ticket file (Decision line). No plugin-to-plugin import, no runtime dependency, no class/enum, no `index/types/utils.ts`.
- Worker flagged a likely trivial merge conflict on `ticket.md`'s Decisions section (their added line vs. main's already-present line) — disclosed, not a defect of the diff itself.

### Notes (non-blocking)
- `ticket.md`'s new Decision line duplicates, in different words, a Decision already on `main` (worker was working from a stale ticket snapshot read before main's update landed). Trivial to reconcile on merge; worker disclosed this.

PASS
