# AR0645 - Review 1

- Job: 2026-11-10-review-5fcd6049
- Branch: arthur/2026-11-09-worker-69fae305
- Commit reviewed: 35f335f0a05dac62a8c931437770a8f4f3af4931
- Verdict: FAIL

## Final message

## Findings

1. **No test covers any of the docker plugin's time limits, so a hung machine could stall a spawn forever without a test catching it.**
   - **Where:**
     - `packages/docker/src/docker-prepare.ts:11` and `:32-34`
     - `packages/docker/src/docker-doctor.ts:6` and `:24`
     - `packages/docker/src/docker.ts:15` and `:53`
   - **What I tried, by hand:**
     - I removed the limit argument from all three `host.jobs.run(...)` calls (`LIMIT_SECONDS` → `undefined`/omitted). The docker tests still passed, 21 of 21.
     - I replaced the prepare's ``ran.code === null ? `timed out after ${LIMIT_SECONDS} s` `` with nothing (`false ? ``` `). The tests passed, 21 of 21.
     - I deleted the doctor's `if (ran.code === null)` line. The tests passed, 21 of 21.
     - `npm run mutate -- --max 150` also left `LIMIT_SECONDS` 30→29 and 30→31 in `docker-prepare.ts:11`, and 10→9 and 10→11 in `docker-doctor.ts:6` and `docker.ts:15`, surviving.
   - **Why it matters:**
     - `execute` (`packages/core/src/job-machine.ts:98-113`) sets no timer when no limit is given.
     - The 30 s cap is the only thing that stops a spawn waiting forever on a machine whose ssh or docker hangs once connected. The ssh `ConnectTimeout` only covers connecting.
     - `docs/docker.md:35` documents that refusal (`... timed out after 30 s`), and nothing tests it.
     - The review criteria count a surviving "limit moved by one" or "refusal disabled" mutation of a key behavior as a FAIL.
   - **The worker's reason doesn't hold.** It says killing these mutants needs a test that waits the real 10–30 s. But `labels.test.ts:87` already swaps a `host.jobs` member (`{ ...host.host.jobs, prepare: ... }`). The same spread can swap `run` to record the limit it gets and to answer `{ code: null, stderr: "timed out after 30 s\n" }`, so no real wait is needed.

## Notes
- (risk) packages/docker/src/docker-doctor.ts:6: the doctor's 10 s limit equals the core doctor's own 10 s cut (`packages/core/src/doctor.ts:16`, `within`). For a hung docker or ssh, the core's `check timed out after 10 s` can win the race. In that case the `fix` getter still returns its first value, `install Docker Engine there ..., or drop docker from its tools label`, which misleads. Discord keeps its call at 5 s for this reason (`discord-doctor.ts:15`).
- (risk) packages/docker/src/docker-label.ts:8: these commands create images without the label: `docker builder build`, `docker buildx b` (aliases of build) and `docker commit`/`image import`. They are outside roadmap 70's list. Per roadmap 72, the sweep never removes a tagged image that no job built.
- (minor) packages/docker/src/docker.ts:56: changing `!root.startsWith("/")` to `root === ""` survives by hand. No test has `docker info` answer something that is not an absolute path.
- (minor) packages/docker/src/docker-options.ts:14: changing `memoryBytes(value, 0)` to `1` or `-1` survives mutate.
- (minor) packages/docker/src/docker.ts:24: deleting `module: import.meta.url` survives mutate.
- (minor) packages/docker/src/docker-doctor.ts:14: changing `2>/dev/null` to `3>/dev/null` survives mutate.

## What holds
- **Sandbox change (AR-D597, option (a)):** it matches the decision. I mutated it three ways by hand and the AR0593 test in `packages/core/test/sandbox.test.ts` caught each:
  - showing `<home>/docker` whole: another job's script and `told` became readable;
  - dropping the shown entry: `bash: .../docker/jobs/<id>/docker: Permission denied`;
  - dropping `filter(existsSync)`: several `hidden` tests failed.
- **The label rewrite:** it covers the full command list of roadmap 70, and the tests cover every label spelling and the image/`--` edge.
- **`after: ["projects"]`:** `npm run mutate` reports deleting it as surviving, but `test/piece-order.test.ts` catches it when run by hand (1 fail).
- **Hand mutations in `docker.ts`:** turning off the macOS notice, the root cache, the unix-socket case and the once-only notice was each caught.
- **Rest of the worker's report:** the line budgets (docker 288 new, machines 535→538, core held at 7445) and the claim that `job-sandbox.ts` was already yellow before this branch match the diff, and the structure test passes.

## Checks (all on 35f335f0)
- `npm run check`: no errors.
- `npm test`: 1698 tests, 1634 pass, 0 fail, 64 skipped.
- `npm run mutate`: 25 mutants, 20 caught, 5 survived. The survivors are the same ones the worker reported: `summary` and `tools` deleted, and `LIMIT_SECONDS` +1 in three files.
- `npm run mutate -- --max 150`: 150 mutants, 134 caught, 16 survived. They are listed in the finding and the notes above, plus two in `test/fake-docker.ts`.
- Hand mutations on `job-sandbox.ts`, three: each caught by `sandbox.test.ts`.
- Hand mutation `after` deleted: caught by `test/piece-order.test.ts`.
- Hand mutations in `packages/docker/src`, seven: four caught. The three not caught are the timeout ones above, plus the absolute-root check in the notes.
- Every mutation was restored with `git checkout --`. `git status --short` was empty afterwards.

FAIL