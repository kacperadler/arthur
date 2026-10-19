# AR0173 - Review 1

- Job: 2026-10-19-review-ar0173-ci-green-3027dc68
- Branch: h/2026-10-19-ar0173-ci-green-ddd65831
- Commit reviewed: f53fc97159441ada4e37ae241ec2798ff2efb5a3
- Verdict: PASS

## Final message

Worktree clean, matches reviewed commit exactly.

---

**Findings (non-blocking):**

- `spec/features/AR0173.../findings.md` (as committed at f53fc97) does not yet contain the 30-run full-suite stress counts the ticket's Done means requires ("the full suite passes 30 times in a row under `taskset -c 0,1`, 3 at once, with the counts in findings.md"). The review task itself states this is being produced by the coordinator out-of-band and will be appended separately, and explicitly instructs the reviewer not to run it — so I did not weigh this absence against the branch; it is called out here for the record.
- GitHub API verification of the "5 green pushes" claim was blocked by the sandbox's shared IP hitting `api.github.com`'s unauthenticated rate limit on every attempt (direct curl and the `read` tool both returned 403/"rate limit exceeded"). I confirmed independently that `origin/h/2026-10-19-ar0173-ci-green-ddd65831` is at the exact reviewed commit `f53fc97`, and the commit history shows the expected "green run N of 5 after `<fix>`" pattern twice (once per fix cycle), consistent with findings.md's narrative. Could not directly re-pull the Actions check-run statuses myself; this is an infra limitation, not a code defect.
- Line-budget raise (core 5116→5127, for `oomFirst`) is documented only as a comment in `test/structure.test.ts`, not as a new `## Decisions` entry in the ticket — but this matches the established precedent of prior tickets in the same file (e.g., AR0167, AR0166), so not a deviation from house practice.

**Checks run (in this worktree, at f53fc97):**

- `npm ci` — fine (cached `node_modules`, instant).
- `npm run check` (`tsc`) — passes, no diagnostics.
- `npm test` under `taskset -c 0,1` (single full run, matching Done means' core pinning) — **564/564 pass**, exit 0, 641.9s wall.
- `node --test test/github-annotations.test.ts` — both new annotation tests pass.
- Manual repro of the `ci.yml` `NODE_OPTIONS` dual-reporter setup against a failing fixture test — produced a correct `::error file=...,line=...,title=...::...` line, matching the documented GitHub annotation shape in findings.md.
- Mutation 1: `LIMIT_SECONDS` in `doctor.ts` 10→5 — the mutated `doctor.test.ts` bound (`>= 9_950`) catches it (`AssertionError`, test fails at ~5000ms); reverted.
- Mutation 2: gutted `oomFirst` in `job-memory.ts` to a no-op (`return start()`) — the new scope.test.ts test ("over a memory cap the kernel takes the agent...") catches it (`'200' !== '1000'`); reverted.
- Mutation 3: disabled the `ECHOES` filter in `test/github-annotations.ts` — the annotations test catches the extra `subtestsFailed`/`cancelledByParent` lines; reverted.
- Confirmed no throwaway probe files (`zz-ci-probe.test.ts`, `zz-oom.test.ts`) remain in the tree; both were cleanly reverted on the branch.
- Confirmed `git status` clean after each mutation revert; worktree matches `f53fc97` exactly.

All ticket Done-means items I could verify directly hold: pinned/split `ci.yml` with a dependency-free annotations reporter proven against both a local fixture and a real GitHub run recorded in findings.md; each flaky-test fix is root-caused (JSONL partial-line race, wall-vs-monotonic clock skew, OOM double-kill ordering) with reproduction evidence, not papered over by a longer sleep or a weakened assertion that hides a real bug — the one assertion that was narrowed (scope.test.ts, end-reason only) is narrowed because the behavior it used to check no longer reliably occurs under the (correct) new OOM-ordering fix, which is itself documented in `docs/commands/spawn.md`; `npm test` and `npm run check` pass. The oom_score_adj change is real, scoped to the moment of `spawn`, and safe by both kernel semantics and direct test execution.

PASS
