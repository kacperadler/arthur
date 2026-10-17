# AR0084 - Review 1

- Job: 2026-10-17-review-ar0084-inbox-c6203af6
- Branch: h/2026-10-17-ar0084-inbox-ceecda3e
- Commit reviewed: 7bb40ca72ed322ffd16a06f8bbd242712dc99946
- Verdict: PASS

## Final message

Reviewed AR0084 branch (inbox.ts, inbox-extension.ts, core changes, tests, docs) against ticket, plan, and the review's focus items.

**Verification performed**

- `npm ci`, `npm run check`: pass (no tsc errors).
- `npm test` (full suite, run in this worktree): 372/372 pass — matches worker's claim exactly.
- `node --import @arthur/core/testing --test packages/orchestration/test/inbox.test.ts` standalone: 14/14 pass (baseline).
- Mutation checks (throwaway edits, reverted with `git checkout --`, confirmed clean after):
  - Removed the mid-turn human-only filter (`if (humans && read(QUEUED, name).channel === undefined) return false` → disabled): `job ends and a schedule message mid-turn wait…` test fails (timeout waiting for two replies). Catches exactly the class of bug the worker says they found and reverted before committing.
  - Disabled the third-failure notice (`=== 3` → `=== 30`): `a hand-over that throws is retried…` test fails (expected `notice`, got `[]`).
  - Disabled the restart-answered dedup (`answered.has(Number(name))` → `false`): `at the start, a message left in turn/…` test fails (the already-answered message is redelivered instead of skipped).
  - All three mutations in the focus list are caught by name-specific assertions, not incidental ones.
- Read `inbox-extension.ts` in full: `ctx.hasUI` guards every handler (`session_start`, `agent_start`, `tool_result`, `session_stop`, `agent_end`); correctly implemented even though untested — worker discloses this gap accurately in the final message (no fabrication).
- Live omp smoke: tried myself (`omp` is on PATH, v18.3.0 matching the plan's assumption) but no model API key is configured in this environment either (`omp --model smol -p "say hi"` → "Model smol not found… Set an API key environment variable"). Genuinely unreachable here, same constraint the worker hit. The plan explicitly frames this as a cost-money smoke "reported in the outcome," not one of the ticket's enumerated Done-means test cases (those are all "tested with the fake agent," which is done); worker's disclosure is accurate, not a fabricated check.
- Line budgets (`test/structure.test.ts`): orchestration 398→658, core/testing 276→340, core 4713→4649. Deltas (+260, +64, −64) match the plan's deltas exactly (300→560, 276→340, 4804→4740), correctly re-based onto AR0080's post-merge numbers, and the comment documents why. `wc -l` on the actual files confirms the budgets hold, and the structure test (which enforces them) passes.
- Core additions (`Jobs.result(id)`, `host.jobs.result`) match the plan's Option 1 exactly; test covers id-shape refusal including path-traversal-shaped ids.
- Fake-agent interactive session (`prompt`/`end` steps, `failSends`, 8-continuation cap, `willContinue`) matches the plan's "Not available directly" Option 1 for `willContinue` and the described cap semantics; traced the cap logic against the "past omp's 8 continuations" test and it's consistent.
- Docs: `docs/commands/coordinator.md` "The coordinator's inbox" section, `roles/coordinator.md` reply/mark rules, `spec/roadmap.md` entry 24 Delivers/Done-means rewrite, entries 39/47, host API paragraph, README status line — all present and consistent with the shipped code.
- Boundaries: `inbox-extension.ts` imports only `node:fs`/`node:path` and a same-package type; `inbox.ts` imports only `@arthur/core/plugin` types. No plugin-to-plugin import, no core-importing-plugin, no runtime dependency added (no `package.json` diffs). No production resource names in tests (tmux socket under `temporaryFolder()`).
- Commits are clean (`a41bcb6` feat, `7bb40ca` docs); no scratch/removal-check script was committed; working tree is clean.

**Notes (non-blocking)**

- Subagent guard (`ctx.hasUI`) has no test; worker discloses this honestly and it's not one of the ticket's enumerated fake-agent test cases.
- Live omp smoke not run by worker or by me (no model credentials in either environment); plan treats this as an outcome-reported risk, not a merge-blocking Done-means item.
- F1/F2 in `findings.md` are reasonable, correctly scoped, non-blocking risks, left `open` for the coordinator to turn into tickets at merge, as the findings process requires.

No finding reaches a FAIL threshold: all Done-means cases are tested and the tests are behavior-sensitive (mutations caught), checks reproduce as claimed, budgets/plan deltas reconcile, boundaries and shape rules hold.

PASS
