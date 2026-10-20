# AR0224 - Review 2

- Job: 2026-10-20-review-ar0224-roadmap-50-956c85dc
- Branch: h/2026-10-20-ar0224-roadmap-50-phone-f10cd1df
- Commit reviewed: 1d3f6f327e83819c9939194d6abf0f1664eec221
- Verdict: PASS

## Final message

The round-1 finding is fixed: the two racy tests now wait for the state they assert, and they pass under load.

**Findings:** none that block the merge.

**Notes**
- The new wait is `received().length === N && queued().length === 0 && api.took().length >= K` (`commands.test.ts:55` and `:88`). Commands are handled in order, so an empty outbox means every earlier reply was sent. The outbox removes a file only after its send (`outbox.ts:94`).
- `>= K` leaves the "command to another bot gets no reply" check weak in theory. The outbox is empty at that point, so I judge it sound.
- `fake-bot-api.ts` now has the four getMe fields the earlier review noted.
- F2 in `findings.md` records the `telegram.test.ts:262` retry flake as a risk. It is marked `[INFERENCE]`, which is honest. That test is untouched by this branch, and this run did not reproduce its failure.
- The `/board` and `/findings` question (cut with a note, or send in slices) is still open for the owner. It is outside this ticket's Scope.

**Checks I ran**
- `npm ci` and `npm run check`: `tsc` passes.
- `npm test`: 775 tests, 775 pass, 0 fail. This matches the worker's claim.
- `commands.test.ts` run 12 times concurrently: 12 of 12 pass, 7 of 7 tests each.
- Mutation: I ran the previous version of `commands.test.ts` (from `dadb2f5`, as a temporary copy since deleted) 8 times concurrently. All 8 runs failed, with 1 or 2 failing tests each, so the fix is what makes the tests stable.

PASS
