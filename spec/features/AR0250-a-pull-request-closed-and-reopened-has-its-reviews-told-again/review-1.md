# AR0250 - Review 1

- Job: 2026-10-21-review-ar0250-reopened-p-60612388
- Branch: h/2026-10-21-ar0250-reopened-pr-revie-8bb4c889
- Commit reviewed: 56ddaba14d82527427c0c46c4ff598d50e174d2e
- Verdict: PASS

## Final message

Well within the 200-line per-file cap.

Summary of verification:
- `npm ci`, `npm run check`, `npm test` all pass (881/881), matching worker's claim.
- Mutation 1 (removed `submitted_at` comparison in `github-pulls.ts`): new reopen test fails, re-telling reviews 70/71 — confirms the fix's necessity and the test's power to catch it.
- Mutation 2 (`readState`'s `pulled` forced to `false`, refusing every pull-request entry): the restart branch of the new test hangs/times out waiting for review 73 — confirms the `polled` persistence is load-bearing and the test exercises it.
- Line budget raise (586→595, +9) is pre-approved in the ticket's Decisions (`github line budget 586 to 595 (+9) accepted`), and the structure-test comment documents it in the established AR0242-style format; actual count matches (595).
- Docs (`github.md`) updated for both the review rule and the "Across a restart" `polled` semantics, matching the code.
- New `findings.md` entry F1 (clock-skew risk) is a reasonable non-blocking risk note, correctly marked `open`, format matches the template used elsewhere (K0000-ticket conversion at merge).
- Diff stays entirely inside `packages/github` + the tracking files (`findings.md`, `test/structure.test.ts`) — no boundary violations, no new deps, no classes/enums, no non-English text, no secrets.
- Edge cases in `github-state.ts`'s `pulled` validator are tested: missing `polled`, non-date `polled`, missing `open`, pre-AR0250 shape — all correctly refused per-entry (other valid entries unaffected).

No findings that block merge.

PASS
