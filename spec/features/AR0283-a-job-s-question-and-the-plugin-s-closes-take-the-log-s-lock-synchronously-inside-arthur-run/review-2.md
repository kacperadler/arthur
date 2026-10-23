# AR0283 - Review 2

- Job: 2026-10-22-review-ar0283-0f326a40
- Branch: h/2026-10-22-ar0283-2e1ee31c
- Commit reviewed: ffed085e4978ebd127540c7dd208f04e6b44ca9f
- Verdict: PASS

## Final message

HEAD matches the commit under review.

## Review summary

**Scope**: re-review of merge commit `ffed085` (merging main into the AR0283 branch, parents `369e395` and main's `08f18f6`). Earlier review of `369e395` already PASSed; judging only the merge's conflict resolution.

**Conflict resolution checked against the follow-up's requirements:**
- `decision-hooks.ts`: `askOfJob` now returns the whole `ask(...)` result typed `JobQuestion = { id, policy? }` (was `.id` only); `queued`'s non-blocking lock behavior from AR0283 untouched. Confirmed via diff against `369e395`.
- `blocked-notice.ts`: `notify` builds AR0285's ending (`— answered by policy (<class>): <decided>`) and the cut-order rule (ending kept, question cut first); the `Promise` branch (AR0283's deferred notice while the lock is held) still routes through the same `notify`. Confirmed matches worker's description exactly.
- `coordinator.md`: both AR0285's policy-ending sentence and AR0283's "not in the decision log yet" wake sentence are present in the same paragraph, in the stated order. `decision.md` merged cleanly with both sides' text (not in the conflict list) — verified both paragraphs present.
- `test/structure.test.ts`: every budget comment (AR0283, AR0274, AR0285) plus the new merge-accounting line present; `BUDGETS.orchestration = 2277`.

**Verification run myself, in this worktree:**
- `npm ci`: clean.
- `npm run check` (tsc): clean, no errors.
- `cat packages/orchestration/src/*.ts | wc -l` → **2277**, matches `BUDGETS.orchestration` and the worker's claim.
- `npm test`: ran to completion (339s) — **1026 pass, 0 fail**, matches worker's claim exactly.
- No leftover `<<<<<<<`/`=======`/`>>>>>>>` markers in any touched file.
- `git status --short`: clean worktree, no stray files.

**Mutation checks** (on `blocked-notice.ts`, reverted after):
- Removed the `decision instanceof Promise` branch (forced synchronous `notify`) → the held-lock test (`decisions.test.ts:238`) fails, correctly catching loss of the deferred-notice behavior.
- Zeroed out the policy `ending` string → the policy-ending test (`decisions.test.ts:744`) fails, correctly catching loss of AR0285's ending.
- Both reverted; `git status --short` clean afterward.

**Gap noted by worker, not a blocker**: no test exercises the *combination* of a held lock and a policy-answered question (delayed notice carrying a policy ending) — each half is tested separately through the same `notify` closure, and the worker disclosed this explicitly as `[INFERENCE]` rather than hiding it. Low risk since it's the same code path already covered twice from different angles; a Note, not a Finding.

**Notes (non-blocking):**
- `decision.md`/`findings.md`/`CHANGELOG.md` changes in this range come from the main-merge content for AR0274/AR0285, not new work by this ticket.
- F1 of AR0283 (notice lost on crash during the queued wait) remains open, as before; out of this ticket's scope and already filed.

No finding rises to a FAIL criterion: checks reproduce exactly as claimed, budgets match `wc -l`, both sides' behavior is kept and tested, no boundary violation, no leftover conflict markers, no secret/workflow/shape issue introduced by the merge.

PASS
