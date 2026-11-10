# AR0645 - Review 3

- Job: 2026-11-10-review-9b4ac888
- Branch: arthur/2026-11-09-worker-69fae305
- Commit reviewed: 881d9cc8e06afb2715a329c145c0b18792349748
- Verdict: FAIL

## Final message

## Findings

1. **`packages/docker/src/docker-label.ts:48`: a job can still label for another job when another option takes `--` as its value (security).** Outside `run` and `create`, the rewrite reads any `--` it meets as the end of the options and keeps everything after it unchanged. A `--` can also be the value of the option just before it, and the rewrite treats it the same way. Docker's parser (pflag) gives a bare `--flag` the next word as its value even when that word is `--`, and then reads the words after it as options. The fix in 881d9cc8 handles a literal `--label` used as a value but not a literal `--`. Same class as review 4's finding, different word.
   - Output of the rewrite (`labelled(args, "mine")`):
     - `build --build-arg -- --label=arthur.job=other .` gives `build --label arthur.job=mine --build-arg -- --label=arthur.job=other .`
     - `volume create --label -- --label=arthur.job=other v` keeps the foreign label.
     - `network create --driver -- --label arthur.job=other n` keeps it.
     - `buildx build -t -- …` and `image build --label -- --label arthur.job=other .` keep it.
     - `run` and `create` are not affected: their known options use up the `--`, and the label is stripped.
   - Real Docker 29.9.2 client on this machine, pointed with `DOCKER_HOST` at a local HTTP listener that logged each request body:
     - `docker volume create --label arthur.job=mine --label -- --label=arthur.job=other v` sent `"Labels":{"--":"","arthur.job":"other"}`.
     - `docker network create --label arthur.job=mine --driver -- --label arthur.job=other n` sent `"Labels":{"arthur.job":"other"}`.
     - Docker keeps the last value for a key, so the foreign label replaces the job's own.
   - Why it fails: roadmap 70's Done means says "a command that already carries `--label arthur.job=<other>` gets the job's own, so a job cannot label for another", and this does not hold.
   - `packages/docker/docs/docker.md:42` says the label "goes wherever it stands" outside `run` and `create`, which is wrong for this case.
   - `labels.test.ts` has no row with a `--` given as a value.
   - A possible fix that fits the worker's strip-everywhere approach: outside `run` and `create`, do not stop at `--`; strip `arthur.job` labels after it too. After a real `--`, those words could only be positionals, so stripping them costs nothing.

## Notes
- (risk) `packages/docker/src/docker-label.ts:59`: stripping a bare `--label` outside `run` and `create` changes what an odd command means, for example `build --build-arg --label arthur.job=x .`. The worker's final message already says so. No foreign label can stay through this path.
- (minor) `packages/docker/docs/docker.md:42`: "outside `run` and `create`, whose options are known" reads as if those other commands' options are the known ones. It is the reverse: `run` and `create` are the ones whose options are listed.

## Checks (on 881d9cc8, detached checkout; `git status` clean afterwards)
- **`npm run check`:** no errors.
- **`npm test`:** 1740 tests, 1676 pass, 0 fail, 64 skipped. Matches the worker's numbers.
- **Structure test:** yellow lines only for files at their base size. `job-sandbox.ts` counts 215 lines at both the base and the tip, measured by the width rule.
- **`npm run mutate`:** 25 mutants, 23 caught, 2 survived, both in `docker-options.ts`:
  - line 10, `summary` deleted;
  - line 12, `tools` deleted.
  - Review 2 confirmed by hand that `test/option-tables.test.ts` catches both.
- **Hand mutation:** I changed the new bare `--label` span rule (`container || ours`) to `true` and ran `labels.test.ts`: 10 pass, 1 fail. Restored with `git checkout --`.
- **`--` bypass:** reproduced with `labelled()` directly, then with the real Docker 29.9.2 client against the local logging listener, as described in finding 1.
- **`--label-file` claim in the docs:** checked the same way. `docker create --label arthur.job=mine --label-file <file holding arthur.job=other> img` sent `{ 'arthur.job': 'mine' }`, so the docs line holds.

FAIL