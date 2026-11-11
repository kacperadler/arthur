# AR0645 - Review 4

- Job: 2026-11-10-review-0fbff8c7
- Branch: arthur/2026-11-09-worker-69fae305
- Commit reviewed: f8e2c46e8767fa00635712638c0e5a71d0fc7ca0
- Verdict: PASS

## Final message

No blocking findings. The latest commit, f8e2c46e, fixes review 3's finding 1. `stripped()` in `packages/docker/src/docker-label.ts:20-38` now drops every word that sets the `arthur.job` key, wherever it stands. A foreign label no longer survives when `--` or `--label` is given as another option's value. I went through every way Docker's argument parser (pflag) can set a label: `--label=V`, `--label V`, `-l V`, `-lV`, `-l=V`, and the grouped forms `-xyl V` and `-xylV`. No foreign `arthur.job` label survives any of them. Spellings like `Arthur.job=…`, a key with spaces, or `x.arthur.job=…` are different keys, so they are not bypasses. Global options are skipped correctly, including `-H=x`, `-Dl debug` and a leading `--`. Every key condition I mutated by hand made `labels.test.ts` fail.

## Notes
- (risk) `spec/roadmap.md:924`: the new rewrite departs from roadmap 70 and plan AR0604. Roadmap 70's Done means says "arguments after the image … belong to the container and are left alone". The plan's Risks line 155 says the same and keeps the `run`/`create` option lists for it. The branch removed those lists, so `docker run img arthur.job=1` now runs `docker run --label arthur.job=<id> img`: the container loses its argument. The worker says so in its final message, and `docs/docker.md:42` describes it. The roadmap example `docker run img --label x` still holds. The upside: the old lists read any long option they did not know as taking a value. So a boolean option added in a later Docker would have let a foreign `--label=arthur.job=…` through, and the new rewrite closes that. The owner should either accept the change and reword the roadmap line, or bring the lists back.
- (minor) `packages/docker/src/docker-label.ts:42`: if I remove `args[at] !== "-"`, the tests still pass. This change makes no real difference: a lone `-` as the first word is an unknown command to Docker either way.

## Checks (on f8e2c46e, detached checkout; `git status` clean afterwards)
- **`npm run check`:** no errors.
- **`npm test`:**
  - 1739 tests: 1675 pass, 0 fail, 64 skipped. This matches the worker's numbers.
  - The structure test passes. Its yellow lines are only for core, delivery and session files; `job-sandbox.ts` is at 215 lines, the same as at the base, as review 3 found.
- **docker line budget:** `packages/docker/src` counts 275 lines under the width rule, matching the new `BUDGETS.docker` of 275.
- **`npm run mutate`:** 25 mutants, 23 caught, 2 survived. The survivors are the deletions of `summary` and `tools` at `docker-options.ts:10` and `:12`. The worker's final message names both, and review 2 confirmed that `test/option-tables.test.ts` catches them.
- **Hand mutations of `docker-label.ts`**, each run against `labels.test.ts` and restored with `git checkout --`. Each of these made it fail:
  - the short-group strip disabled;
  - the `--label=` strip disabled;
  - the pop of `--label` or `-…l` removed, both its whole condition and only its `-…l` part;
  - the `-dl` → `-d` re-push disabled;
  - `short[1] !== "-"` forced true;
  - `KEY` with `(=|$)` cut to `(=)`;
  - `SHORT` without `=?`;
  - the leading-`--` skip removed;
  - the global option spans forced to 1, both the long and the short ones.
  - Only `args[at] !== "-"` removed survived (see Notes).
- **Worker's claim about 881d9cc8:** with that commit's `docker-label.ts` in place, `labels.test.ts` gave 8 pass, 2 fail. This reproduces the worker's claim.
- **Direct probes of `labelled()`:** `-dl=arthur.job=o`, `-tdlarthur.job`, a bare `--label arthur.job`, `--debug -- container create -l …`, `-H=x`, `Arthur.job=o`, and an `arthur.job=` word inside a quoted container command. Each gave the expected result.
- **Leftover process:** the `npm test` run left a fake agent running (pid 2910316, `packages/core/src/fake-agent.ts`). I stopped it, and `ps -p 2910316` no longer lists it.

PASS