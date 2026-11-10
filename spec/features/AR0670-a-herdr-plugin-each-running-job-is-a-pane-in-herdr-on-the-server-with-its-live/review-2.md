# AR0670 - Review 2

- Job: 2026-11-10-review-bc43d045
- Branch: arthur/2026-11-09-worker-bafad861
- Commit reviewed: 6706f78c07b265451a96c6749e04ca95456995b3
- Verdict: PASS

## Final message

I found no blocking issues on tip `6706f78c`. The branch does what AR0670 and the approved plan ask, and review 1's finding is fixed.

- **Review 1's finding is fixed.** The state table in `packages/herdr/docs/herdr.md` now has its `ended` row (`idle`, `ended: <reason>`). The stray paragraph is gone, and the "When herdr is missing" paragraph now says what the code does: `arthur run` puts the line in its start notice at most once a day. The note about when a closed `coordinator` tab comes back is also fixed: the doc says the next herdr call reopens it, which matches `space(true)` in both event handlers.
- **Review 1's other notes are filed.** F1 (a hung herdr adds 5 s per event), F2 (three calls per `job-state`) and F3 (no test of the `failed.message` fallback) are in the ticket's `findings.md`, each `Status: open`.
- **The ticket's Done means are met.** `arthur jobs --follow` has its `--help` section. The plugin opens one tab per job, labelled `<ticket> <kind> <short id>`, and the workspace has a `coordinator` tab running `arthur attach`. It reports `working`, `blocked` with the reason, and `ended` as `idle` with `ended: <reason>` (the plan's Option 1, since herdr has no done state). A prune closes the tab, and `arthur doctor` gives one line that is never critical. The roadmap (entry 115), the vision table, the README and `arthur.config.example.ts` are updated.
- **The fake herdr matches the recorded shapes.** `fake-shapes.test.ts` checks every route the fake answers with JSON on success, against the keys recorded from herdr 0.9.3's schema.
- **Boundaries and sizes hold.** The herdr package imports only `@arthur/core/plugin`, `@arthur/core/option-table` and `@arthur/core/testing`, and has no runtime dependencies. Every changed source file is green: 55 to 100 lines. The core budget is 7510, within the 7530 allowed by AR-D589; herdr starts at 250, as the plan says.

## Notes
- (minor) arthur.config.example.ts:395,398: the two `survived:` mutants still leave `npm run mutate` at exit 1, though the ticket's Done means asks for a passing run. The cause is the known mutate limit in AR0614's deferred finding F1. The worker gave the reason, and review 1 accepted it.
- (minor) packages/core/src/run-record.ts:57: agent text that ends in a line break leaves an empty `> ` line in `log`. `"Done.\n"` becomes `"> Done.\n> \n"`, checked with node.
- (minor) packages/core/src/job-commands.ts:52: `jobs` keeps `inJob: true`, so an agent can run `arthur jobs --follow <its own id>`. That call then blocks until its own run ends.
- (minor) packages/herdr/src/herdr-cli.ts:80: `--message <reason>` is passed as it is. A reason starting with `-` could be read as a flag by herdr. The core's reasons start with a word such as `user:` or `dependency:`, so this is probably not reachable [INFERENCE].

## Checks (all on 6706f78c, in this checkout)
- `npm run check`: tsc passed with no errors.
- `npm test`: 1695 tests, 1631 pass, 0 fail, 64 skipped.
- `npm run mutate -- --max 25`: 25 mutants, 23 caught, 2 survived (`arthur.config.example.ts:395: hunk reverted to the base`, `arthur.config.example.ts:398: herdr(), => (deleted)`), 407 not run.
- Hand mutations, each restored with `git checkout --`; `git status` was clean afterwards:
  - `herdr.ts`: removed the `inRun(job)` check from the `job-started` handler. `herdr.test.ts`: 1 failed, 10 passed.
  - `herdr.ts`: turned off the start pass's report for ended jobs that still have a tab. `herdr.test.ts`: 1 failed, 10 passed.
- CLI by hand, in a throwaway folder `/tmp/rv-herdr-*` (removed afterwards), with a hand-made record:
  - `arthur jobs --help` prints the `## --follow <id>` section.
  - `--follow 0000beef` printed `read a.md` and `state: working`. After a line was appended and the end written, it printed `> hi` and `state: ended (finished)`, then exited 0.
  - `--follow deadbeef` printed `arthur jobs: deadbeef: no such job in …/.arthur/jobs` and exited 1.
  - `--follow 0000beef --state ended` printed `--follow goes without --state` and the usage line, and exited 2.
- Real herdr was not run: this checkout cannot reach herdr's socket. The owner's steps on the server in `packages/herdr/docs/herdr.md` are still to do.

PASS