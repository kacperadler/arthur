# AR0647 - Review 1

- Job: 2026-11-11-review-7ad0a87d
- Branch: arthur/2026-11-11-worker-5f2781a0
- Commit reviewed: 5a4c2690dc370966657dd4e7325f773f66bcaab1
- Verdict: FAIL

## Final message

I reviewed `5a4c2690` against base `31e09905`. Most of the sweep works and is tested, but the branch fails review: the tests miss three of the conditions that decide whether a notice goes out, and one roadmap line still describes the old sweep.

## Findings

1. **`packages/docker/src/docker-sweep.ts:138`: no test checks that a failure or a disk still under its floor sends a notice.** I changed the condition from `each.failed || each.reclaimed || each.under` to `each.reclaimed` alone, and all 10 tests in `sweep.test.ts` still passed.
   - Every test that expects a notice also removes something on `local`. That holds in "a machine offline…", "Docker stopping half-way…" (4 containers removed, or 1 after the time limit) and the disk-low test.
   - So a daily sweep where every machine is offline, or Docker does not answer, could send no notice, and the tests would not notice. The same goes for a sweep that removes nothing but leaves the disk under its floor.
   - This is what the ticket asks for ("one notice per sweep") and what `docs/docker.md` promises: lines for offline machines and "still under the floor", and silence only when nothing failed.
   - Each part of the condition is a key behavior, and the tests miss its removal.

2. **`packages/docker/src/docker-sweep.ts:116`: no test covers a sweep whose only gain is the build cache.** I changed `reclaimed: removed.length > 0 || freed > 0` to `removed.length > 0`, and all 10 tests passed.
   - In that case a sweep that frees gigabytes by pruning the cache, while removing no object, sends no notice. The docs say there is no notice only "when nothing was reclaimed".

3. **`spec/roadmap.md:926` (entry 70) still says unlabelled stacks are "left to the sweep".** The line reads: "a compose `-p <name>` the job gives wins, and that stack is left to the sweep; `docker` called by its absolute path, or Docker's API called from a library, is unlabelled and left to the sweep".
   - With the approved limit (AR-D520), the sweep takes only dangling images, unused networks and old build cache from such stacks. Their containers and volumes stay.
   - The branch corrected the same sentence in `packages/docker/docs/docker.md` ("Unlabelled: … the sweep takes of them only …") and entry 72 of the roadmap, but not entry 70.
   - The roadmap is not in the ticket's Scope Out, so this stale line fails the branch.

## Notes
- (minor) `packages/docker/src/docker-sweep.ts:21`: no test checks that a paused or restarting container is kept. Adding `"paused", "restarting"` to `STOPPED` survives all 10 tests. The fixture only has a `running` container. Docker's own `rm` without `-f` refuses these containers today, so the harm is limited.
- (risk) `packages/docker/src/docker-sweep.ts:123`: `queueLock` is called outside the `try`. If the 12-minute lock wait runs out, `sweep` stops for every remaining machine, not just this one. The comment says "a throw costs its machine only".
- (minor) `packages/docker/src/docker-look.ts:207`: an image with several tags shows up once per tag under the same ID. Its `image:<id>` word then repeats, and `docker image rm <id>` is refused as "referenced in multiple repositories".
- (minor) `packages/docker/src/docker-look.ts:182`: labels are split on `,`, so a label value that contains a comma (compose's `config_files`) makes extra keys.
- (minor) `spec/vision.md:161`: "left to the sweep" has the same problem as finding 3. This adds to F1, which names only line 167.
- (minor) `spec/features/AR0647-…/findings.md` F2: its Status is `open`, but the worker's message says AR0692 fixed it on main. It should read `fixed in` or `dropped`.

## Checks (on `5a4c2690`)
- **`npm run mutate`:** 25 mutants, 21 caught, 4 survived, none `not run (time)`. The 4 survivors are the ones the worker listed: `arthur.config.example.ts:418`, `docker-options.ts:20`, `fake-docker.ts:20`, `docker-options.ts:22`. All are comments or help text.
- **Hand mutations,** each run against `packages/docker/test/sweep.test.ts` and restored with `git checkout -- packages/docker/src/docker-sweep.ts`:
  - notice condition reduced to `each.reclaimed`: survived (10 pass, 0 fail);
  - `each.under` dropped from the notice condition: survived (10 pass, 0 fail);
  - `|| freed > 0` dropped: survived (10 pass, 0 fail);
  - `STOPPED` extended to paused and restarting: survived (10 pass, 0 fail);
  - per-machine lock replaced by a no-op: caught ("the second waits").
- **`npm run check`:** tsc passes.
- **`npm test`:** 1757 tests, 1693 pass, 0 fail, 64 skipped. The structure test passes; docker's files are all green, the largest being `docker-sweep.ts` at 139 lines.
- **Worktree:** clean after the checks.
- **Not run:** a smoke run against real Docker. No machine with Docker is reachable from this review.

FAIL