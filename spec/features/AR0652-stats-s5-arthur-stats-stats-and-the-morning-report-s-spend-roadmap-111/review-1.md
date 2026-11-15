# AR0652 - Review 1

- Job: 2026-11-13-review-ee222c1d
- Branch: arthur/2026-11-13-worker-e7442a45
- Commit reviewed: 04b236c32025b90826d14dc5f5880be69e4094a1
- Verdict: FAIL

## Final message

I checked the code against roadmap entry 111 and the plan's section 4, and it does what they ask. The real CLI's output is correct. The branch still fails review because the tests miss four behaviors: in each case below I changed the code by hand, the stats tests still passed (20 of 20), and I restored the file.

## Findings

1. **`packages/stats/src/spend.ts:66`: no test checks "tickets merged in the span".** Removing `&& inSpan(filter.since, host.clock, Date.parse(ticket.updated))` from `merged` breaks no test. In every fixture, the merged ticket was also merged inside the span. A ticket merged before the span but still spent on inside it would then be counted under "Whether it pays: on N tickets merged …", which the roadmap names explicitly.

2. **`packages/stats/src/spend.ts:18`: no test checks that a run stopped at a limit counts as failed or stopped.** Changing `/^(?:failed|stopped|limit:)/` to `/^(?:failed|stopped)/` breaks no test. That would hide every run that ends `limit: budget: …`, `limit: time: …` or `limit: memory: …` from "N failed or stopped" by role, project and day, and from "on runs that failed or were stopped". Those are the usual way a run gets stopped, and `docs/commands/stats.md` lists `limit:` as one.

3. **`packages/stats/src/spend.ts:71`: no test covers a span with no merged ticket.** Replacing `money(count > 0 ? on(merged) / count : 0)` with `money(on(merged) / count)` breaks no test, and it would print `$NaN per ticket`. Every full-view fixture has exactly one merged ticket in the span. The `--role coordinator` case only checks for "Most expensive tickets: none".

4. **`packages/stats/src/spend-read.ts:61`: no test checks that runs are sorted oldest first.** Replacing `kept.toSorted((a, b) => a.time - b.time)` with `kept` breaks no test. `--ticket` and `/stats <id>` are documented to list runs "the oldest first", but the `--ticket` test has one run, and the `/stats AC0012 30d` test checks only the header line. The fixture already writes AC0012's runs out of time order, so a full-line assertion would catch this.

## Notes
- (minor) `packages/stats/src/stats-lines.ts:24`: no caller reads the default `unread = { lines: 0 }`. That is why its two mutants (`lines: 1`, `lines: -1`) survive. The worker's message says the same.
- (minor) `packages/stats/src/spend.ts:94`: removing `row.missing ? [] :` from the By model rows breaks no test. Missing lines carry cost 0, so nothing visible changes today.
- (minor) `packages/stats/src/spend.ts:44`: each share is rounded on its own, so "By day" shares can add up to 101%. I saw `63%` and `38%` in a real run.
- (minor) `test/structure.test.ts:58`: the stats budget goes from 303 to 531 (+228, against the plan's +200). The final message names it; the merge's `outcome.md` has to show it.
- (minor) `docs/plugin-api.md:139`: AR0651's entry in the change log still says the report is what "`arthur stats` prints". It is a dated record, not current docs.

## Checks (on 04b236c3)
- **`npm run check && npm test`:** tsc clean; 1813 tests, 1749 pass, 0 fail, 64 skipped (663 s).
- **`npm run mutate`:** 100 mutants, 91 caught, 9 survived. These are the same nine the worker reported: the `summary` line, 4 mutants of the `/stats` menu text, 2 of `readLines`' `unread` default, and the deleted `inJob: true`.
- **`inJob: true` deleted by hand:** `test/job-gate.test.ts` fails 1 of 2 with `refused inside a job …`. Restored.
- **Hand mutations of `spend.ts` and `spend-read.ts`, stats tests after each:**
  - Survived (20 of 20 pass): the four in the findings above, plus `row.missing` and `spent <= 0`.
  - Caught: the equal share per ticket (2 fail), the no-time line counted as unread (2 fail), the `--project` filter (1 fail), extra words in `/stats` (1 fail), `/stats` inside a job (1 fail), empty words in `/stats` (1 fail), and `sub` (3 fail).
  - Every file restored with `git checkout`; `git status` is clean.
- **Real CLI outside a job:** in a temporary folder with its own home and `ARTHUR_JOB=""`, the way `job-gate.test.ts` runs it, with orchestration, projects and stats loaded:
  - `stats`, `stats --since 1d` and `stats --project shop` print every section. The `limit: budget:` run is counted as failed or stopped, and the cut line as 1 not read.
  - `stats --ticket SH0001` lists its runs; `stats tickets` prints the report.
  - `stats --project nope` exits 1 (`unknown project nope; projects: shop`).
  - `stats tickets x` and `stats --since 0d` exit 2 with their usage lines.
  - `stats --help` and `stats tickets --help` print their pages.
  - The folder is removed.

FAIL