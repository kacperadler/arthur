# AR0073 - Review 1

- Job: 2026-10-16-review-ar0073-core-dedup-67028b44
- Branch: h/2026-10-16-ar0073-core-dedup-and-co-0a7f996f
- Commit reviewed: 879ec9949ff3b4c605e23ad47bd9b65552ded0c0
- Verdict: PASS

## Final message

Working tree clean after mutation tests restored. Final verdict.

---

**Findings:** none that block merge.

**Notes (non-blocking):**
- `packages/core/src/jobs.ts:packages/core/src/jobs.ts` final message says "jobs.ts is 189 lines, below its 200-line cap"; actual `lineCount` (matching `test/structure.ts`'s own algorithm) is 192. Still under the 200-line cap, and the reported aggregate total (4339) is exactly correct, so this is an incidental inaccuracy in supporting detail, not in the graded number.
- New finding F1 in the ticket's `findings.md` (two same-named plugins each still print a separate line) is correctly left `open`, matches the ticket's "no behaviour change" scope, and is distinct from AR0069's F1 (refused single entry printed twice), which this branch does fix.
- `BUDGETS.core` in `test/structure.ts` stays at 4372 (not lowered to 4339); the plan's tickets-to-create list puts the budget rewrite in a separate ticket (#8), so this is intentional, not an omission.

**Checks run (in this worktree, at the reviewed commit):**
- `npm ci` — clean.
- `npm run check` (`tsc`) — no errors.
- `npm test` — 272/272 pass.
- `cat packages/core/src/*.ts | wc -l` → 4339, matching the ticket's accepted 33-line cut and the worker's claim.
- Smoke: `node packages/core/src/cli.ts config check` against `[1, { name: "orchestration", setup() {} }]` printed the refusal once (`plugins[0]: expected a plugin such as youtrack({ ... }), got 1`) then the env line, exit 1 — matches worker's claim and fixes AR0069's F1.
- Mutation tests (each reverted with `git checkout -- <file>` afterward, confirmed clean):
  - Disabled the `setup`-function refusal in `plugin.ts`'s shared `asPlugin` → caught by `host.test.ts`.
  - Made shared `pluginStep` swallow/not wrap errors → caught by `spawn.test.ts` (message no longer names the plugin/step).
  - Forced shared `wrapperRuns` to always return `true` → caught by `job-control.test.ts` and `job-records.test.ts`.
  - Inverted the `existsSync` check in shared `field` (missing file reads via `readFileSync`, present file reads `""`) → caught by `job-control.test.ts` and `job-records.test.ts` (steer/jobs-listing failures).
- Verified `env.ts`'s `asPlugin` import/removal, `host.ts`'s `describe`/`asPlugin`/`pluginStep` removal, `jobs.ts`'s `step`→`pluginStep` swap, and `job-control.ts`/`job-records.ts`/`board-commands.ts`'s shared `field`/`wrapperRuns` by reading full diffs; no copy of any of the four consolidated pieces remains in any former caller.
- Confirmed no import cycle: `job-control.ts` does not import `job-records.ts`; `env.ts`→`plugin.ts` only (no `host.ts` import, avoiding the cycle the worker describes).
- Confirmed scope: every touched file maps to A1–A5 or to the doc/test edits the final message names; nothing outside is touched.

PASS
