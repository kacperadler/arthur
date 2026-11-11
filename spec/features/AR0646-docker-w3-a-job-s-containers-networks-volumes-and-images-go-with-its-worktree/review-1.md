# AR0646 - Review 1

- Job: 2026-11-11-review-7afc2635
- Branch: arthur/2026-11-11-worker-48cf9b11
- Commit reviewed: 2f37a590f52b1b3e7e15aea0ad90e042d7b4c363
- Verdict: PASS

## Final message

No blocking findings. The branch does what W3 of the AR0604 plan and roadmap entry 71 ask, and the ticket's Decisions section is empty, so there is nothing for it to contradict. The full set of checks I ran passed on 2f37a590.

Every edge case entry 71 names has a test in `packages/docker/test/cleanup.test.ts`:
- Docker not installed gives no line.
- Docker not running gives one notice, the worktree is removed and nothing is touched.
- A running container is stopped, then removed.
- A volume, network or image that another job's container uses is kept and named.
- A job on another machine is cleaned there, and when that machine is offline Docker is never reached.
- A failure half-way keeps what went and names the rest.
- A second prune ends in "nothing of the job's in Docker".
- With `buildCache: 0` the cache is not cut.
- A job that made nothing gets only the cache cut.

The docs, README, `arthur.mmd` and `arthur.config.example.ts` no longer say the cleanup is planned, and no stale mention is left. The `docker` line budget goes from 275 to 393, which the final message names, close to the plan's +120. Every docker source file stays green (the largest, `docker-cleanup.ts`, is 105 lines). The worker's claimed results match what I got.

## Notes
- (risk) `packages/docker/src/docker-cleanup.ts:24`: no test catches the removal of the listing's error exit. I removed `|| exit` after each `docker $kind ... --format '{{json .}}'` and all 30 docker tests still passed. If one listing fails briefly while the later ones and `system df` succeed, that kind is silently skipped: the hook still succeeds, gives no notice, and the line leaves out what was not listed. If the daemon stays down, `system df` fails too and the hook still gives up, so the practical effect is narrow.
- (minor) `packages/docker/src/docker-cleanup.ts:37`: no test catches removing `up;` from the build-cache refusal branch either (30 pass). A daemon lost at `docker builder prune` then fails at the final `system df` and gives up as "the removal exited 1" instead of "Docker stopped answering". The outcome is the same and only the reason text changes.
- (bug) `packages/docker/src/docker-cleanup.ts:86`: images are removed by ID. An image the job built with two tags (`build -t shop:latest -t shop:1`) is refused by Docker ("image is referenced in multiple repositories", must be forced), so it is kept and named at every prune and waits for the sweep [INFERENCE from Docker's documented behaviour; not exercised by the fake].
- (minor) `packages/docker/src/docker.ts:44`: the check for which jobs are the plugin's (project not `docker.project(false)`, labelled machine) and the `Listed` type now exist twice, once in `docker.ts` and once inside `docker-prepare.ts`. The final message explains why, and the styleguide accepts a short duplicate.
- (minor) `packages/docker/src/docker-options.ts:10`: the plugin's one-line `summary`, which `arthur setup` prints, does not mention the cleanup. It is incomplete, not wrong, and the file is outside this range.

## Checks (all on 2f37a590)
- `npm run check && npm test`: tsc found no errors. Tests: 1728, pass 1664, fail 0, cancelled 0, skipped 64 (systemd and tmux tests this host cannot run).
- `npm run mutate`: 25 mutants, 25 caught, 0 survived; 430 not run (`--max 25`).
- My own mutations, each followed by `node --import @arthur/core/testing --test packages/docker/test/*.test.ts` and restored with `git checkout -- packages/docker/src/docker-cleanup.ts`:
  - `up;` removed from the build-cache refusal branch: 30 pass, 0 fail (survived).
  - `|| exit` removed after each listing: 30 pass, 0 fail (survived).

PASS