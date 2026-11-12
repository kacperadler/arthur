# AR0647 - Review 3

- Job: 2026-11-12-review-bc24966a
- Branch: arthur/2026-11-11-worker-5f2781a0
- Commit reviewed: 2fb79fa3eb8baddc72f8c4c671619b7b6c37b447
- Verdict: PASS

## Final message

No blocking findings. Review 2's three findings are fixed, and each fix has a test that fails when the code is weakened. I reproduced all three on `2fb79fa3`:

- **Review 2, finding 1:** with `if (ran.code === 3) return …` deleted from `docker-look.ts`, the new test "a labelled machine where command -v finds no docker is no failure…" fails (`sweep.test.ts`: 11 pass, 1 fail).
- **Review 2, finding 2:** with the dangling check's `&&` changed to `||` in `docker-sweep.ts:58`, `sweep.test.ts` gives 7 pass, 5 fail. The fixture's new image `postgres:<none>` (one pulled by digest) catches it.
- **Review 2, finding 3:** with `STOPPED` narrowed to `["exited"]`, `sweep.test.ts` gives 7 pass, 5 fail. The fixture now has `old-db` as `created` and `old-dead` as `dead`.

The rest of the branch meets W4 in the AR0604 plan:
- **When the sweep runs:** daily as the `docker.sweep` schedule entry, refused at load without schedule; on `disk-low` while `arthur run` runs; by hand with `--machine` and `--dry-run`.
- **How it runs:** one sweep at a time per machine, behind `queueLock`, and one notice per sweep.
- **What it removes:** what a job that no longer exists labelled; unlabelled, only dangling images, unused networks and the build cache (AR-D520).
- **Docs:** `arthur docker` and `arthur docker sweep` have their pages, and `docs/plugin-api.md` lists docker under `schedule.register`.
- **Budget:** docker's line budget is 694, as the worker's message says, close to the plan's "about 690". Every docker file is green; the largest, `docker-sweep.ts`, has 139 lines.
- **Fakes:** Docker and SSH are faked, and the fake answers in the recorded shapes, which `fake-shapes.test.ts` checks.
- **Changelog and vision:** the plan's `CHANGELOG.md` line is the merge's job, since entries are added by `spec: … merged` commits. `spec/vision.md:161,167` still describe the old sweep; F1 already records that for the owner.

## Notes
- (minor) `packages/docker/src/docker-look.ts:24`: a `docker image inspect` that fails (an image removed between `image ls` and `inspect`) is not checked. A dangling image of a live job whose labels it misses counts as unlabelled, so the sweep can remove it once it is `leftoverHours` old.

## Checks (on `2fb79fa3`)
- **`npm run check && npm test`:** tsc passes. 1759 tests: 1695 pass, 0 fail, 64 skipped.
- **`npm run mutate`:** 25 mutants, 21 caught, 4 survived, 611 not run (`--max 25`). The 4 survivors are the comment and help-text hunks the worker listed: `arthur.config.example.ts:418`, `docker-options.ts:20`, `fake-docker.ts:20`, `docker-options.ts:22`.
- **Hand mutations,** each run against `packages/docker/test/sweep.test.ts` and restored with `git checkout -- packages/docker/src`. All were caught:

  | Mutation | Result |
  |---|---|
  | `ran.code === 3` line deleted (`docker-look.ts`) | caught (11 pass, 1 fail) |
  | dangling `&&` changed to `\|\|` | caught (7 pass, 5 fail) |
  | `STOPPED` = `["exited"]` | caught (7 pass, 5 fail) |
  | `arthur.keep` guard removed | caught (7 pass, 5 fail) |
  | `thing.kind === "network"` guard removed, so unlabelled containers and volumes become removable | caught (7 pass, 5 fail) |
  | `!running` removed from the `disk-low` handler | caught (11 pass, 1 fail) |
  | refusal of an unlabelled `--machine` disabled | caught (11 pass, 1 fail) |
  | `dryRun > 1` refusal removed | caught (11 pass, 1 fail) |
  | `recordOf`'s compose-project match removed | caught (8 pass, 4 fail) |

- **Worktree:** `git status --short` was empty after the mutations.
- **Not run:** a smoke run against real Docker. No Docker daemon is reachable from this review.

PASS