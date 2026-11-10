# AR0670 - Review 1

- Job: 2026-11-09-review-2384b0b7
- Branch: arthur/2026-11-09-worker-bafad861
- Commit reviewed: 01fcdbb583d554148456ea020dfa5c89f1625491
- Verdict: FAIL

## Final message

## Findings

1. **`packages/herdr/docs/herdr.md:49-53`: the state table has no `ended` row, and a stray paragraph is stuck in it.**
   - The table under "What each state means in herdr's sidebar" lists `working`, `idle` and `blocked` only. It leaves out the mapping the code uses for `ended`: herdr state `idle`, message `ended: <reason>` (`herdr-cli.ts` `REPORTS.ended`, tested in `herdr.test.ts`). That is the "done" state the ticket names.
   - In its place, line 53 holds a copy of the "When herdr is missing" paragraph (line 59). There is no blank line before it, so Markdown renders it as a broken row of the table. The copy also contradicts the original: line 53 says "`arthur run` puts it first in its start notice", while line 59 says "sends it as a notice".
   - Why it fails: the ticket's Done means asks that `packages/herdr/docs/herdr.md` say "what each pane and state means", and the owner asked for the docs by name (AR-D587). The page the owner will follow on the server shows a corrupted table with the end state missing. The worker's final message presents the four-row table as built and lists the doc as done, so that claim does not match the file.
   - Fix: replace line 53 with `` | `ended` | `idle` | `ended: <reason>` | ``, then a blank line.

## Notes
- (minor) arthur.config.example.ts:395,398: the two `survived:` mutants (`hunk reverted to the base`, `herdr(), => (deleted)`) leave `npm run mutate` at exit 1 (`test/mutate.ts:80`). The plan asked for "no `survived:` line". The cause is the known mutate limit in AR0614's deferred finding: a root file's mutants run only the root `test/`. The worker gave the reason, so this does not block.
- (minor) packages/herdr/docs/herdr.md:37: it says a closed `coordinator` tab comes back at "the next start of `arthur run`". The code reopens it sooner: every `job-started` and `job-state` calls `space(true)` (`herdr.ts`), which reopens it.
- (risk) packages/herdr/src/herdr.ts: when herdr hangs, every event adds a call to the one chain, and each such call waits the full 5 s. A `jobs.cleanup` in `arthur run` then waits behind all of them. In another process, `arthur prune --all` costs about 5 s per job. This is [INFERENCE] from the code; I did not measure it.
- (minor) packages/herdr/src/herdr.ts: each `job-state` makes three herdr calls (`workspace list`, `tab list`, `pane list`) before its report.
- (minor) packages/herdr/src/herdr-cli.ts: no test covers the `failed.message` fallback (empty stderr, or an answer that is not JSON). The worker disclosed it, but it is not in `findings.md`.
- (minor) commit `550d87d1`: the subject says `test(...)`, but the commit also changes source (`job-follow.ts`, `herdr-cli.ts`). The worker disclosed it.

## Checks (on 01fcdbb5, this checkout)
- `npm run check`: tsc, no errors.
- `npm test`: 1695 tests, 1631 pass, 0 fail, 64 skipped.
- `npm run mutate -- --max 25`: 25 mutants, 23 caught, 2 survived (both in `arthur.config.example.ts`, as above). 407 not run (`--max 25`). Exit code 1.
- Hand mutations, each restored with `git checkout --` and `git status` clean afterwards:
  - `job-follow.ts`, guard on `state`'s inode and mtime removed: 2 tests in `job-follow.test.ts` fail. The run then hung and was cut at its 600 s timeout.
  - `herdr.ts`, `if (started)` in the `job-state` handler made always true: 1 test fails ("before start nothing reaches herdr…"), 10 pass.
  - `herdr.ts`, the serial chain replaced by concurrent tasks: 1 test fails ("each job state as herdr shows it…"), 10 pass.
- CLI in a temporary folder:
  - `arthur jobs --help` prints the `## --follow <id>` section.
  - `arthur jobs --follow` gives `--follow needs a value` and the usage line, exit 2.
  - `--follow abc --state ended` gives `--follow goes without --state` and the usage line, exit 2.
  - `--follow deadbeef` with no config exits 1 on the config error. I did not reach the unknown-id refusal through the CLI; `job-follow.test.ts` covers it.
- Read `herdr.md`, `job-follow.ts`, `herdr.ts`, `herdr-cli.ts`, `fake-herdr.ts`, `herdr.test.ts` and `job-follow.test.ts` on disk.
- Boundaries hold: herdr imports only `@arthur/core/plugin`, `@arthur/core/option-table` and `@arthur/core/testing`; no runtime dependencies. Budgets: core 7510, within the 7530 AR-D589 allows; herdr 250. No new yellow or red file.

FAIL