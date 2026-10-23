# AR0298 - Review 1

- Job: 2026-10-22-review-ar0298-ef7dfdd0
- Branch: h/2026-10-22-ar0298-8e2fe51c
- Commit reviewed: 982647ba30681d8241e04f65bcd4c6a675004ebf
- Verdict: PASS

## Final message

Worktree clean, no leftover mutations.

---

**Findings:** none that block merge.

**Notes (non-blocking):**
- Ticket's Goal line "First check on a real second machine whether `arthur.config.ts` is missing there" was not done against a real host — no second machine is reachable from this sandbox either (`ssh gpu` fails to resolve, no Tailscale host configured). Worker substituted the closest available proof: ran the actual line against a bare clone produced the same way `arthur remote-job repo` makes it, got the exact `unknown command plugin`/exit 2 failure, and labeled the generalization to a real machine `[INFERENCE]` — matching the ticket's own epistemic tag for the same unverified claim. Given neither the worker nor this review had access to a real second machine, this is an infra constraint, not a shortcut; it does not amount to a faked or stubbed check.
- F1 finding (unplanned ticket still placed remotely) is an honestly disclosed gap in the `- Plan: yes` requirement, properly filed under `findings.md`, `open`, not blocking this ticket's own Done means.

**Checks run (in this worktree, against `dae5a18..9826 47b`):**
- `npm ci`: clean, no output/errors.
- `npm run check` (`tsc`): exit 0, no diagnostics.
- `npm test`: 1034 tests, 1034 passed, 0 failed, 0 cancelled — matches the worker's claim exactly.
- `node --test packages/develop/test/plugin-new.test.ts`: 4 passed — matches claim.
- Verified `job.machine` is a real, always-present field on `Spawn`/`Job` (`packages/core/src/jobs.ts:56-62`), so the new `pluginNewSection` parameter type is not a lie about the caller's shape.
- Verified develop's line count: `find packages/develop/src -name "*.ts" | xargs wc -l` → 672 total, matching the `BUDGETS` raise to 672 and the ticket's pre-approved raise (670→672).
- Verified `arthur remote-job --help` text: line 7 says "a bare repository", matching the doc's citation.
- Mutation 1 — inverted `job.machine !== "local"` to `=== "local"`: test failure (worker-on-local wrongly gets the "cannot run there" message) — caught.
- Mutation 2 — dropped the `role === "worker" &&` guard (message now fires for planner too): test failure (planner on another machine wrongly gets the worker's "no line" message instead of its normal section) — caught.
- Restored `plugin-new.ts` after each mutation; `git status --short` clean before verdict.
- Spot-checked diff boundaries: only `packages/develop/*`, `packages/orchestration/roles/coordinator/plan-ended.md` (prose instruction, not code, no plugin-boundary violation), and the root `test/structure.test.ts` budget line changed — no plugin imports another plugin, no core-by-path import, no secret, no non-English text, no listener on a public address.

Diff implements the ticket's first allowed option end-to-end: worker-on-another-machine told plainly to leave the ticket to local (no more `unknown command plugin` leak), planner told the plan must pin the worker to `local`, and `plan-ended.md` step 4 updated so the coordinator actually spawns with `--machine local` when the plan says so — matching "orchestration places such a job there." Tests cover both roles, both machines, the exact CLI failure text, and the untouched local path. Line-budget raise matches the ticket's pre-approved decision and the real line count.

PASS
