# AR0724 - Review 1

- Job: 2026-11-18-review-db4c95b4
- Branch: arthur/2026-11-18-worker-37bcba2e
- Commit reviewed: 39117ba86ddd95816d8e2222fb43e0521b104c45
- Verdict: PASS

## Final message

No findings: nothing in the range fails the review criteria.

The branch does what the ticket asks. `packages/docker/test/fake-docker.ts` no longer imports `@arthur/core` and reads `--max-used-space` itself, which is one of the two options Done means allows. Nothing else changed: `docker-shapes.json`, every existing test's expected answer and `packages/core/package.json` are untouched. The 60 CPU-s threshold was replaced by the measured 19.2 CPU-s fall in AR-D699, and the worker's final message gives the before and after numbers the outcome needs. `fake-docker.ts` is 286 lines, but `test/structure.ts` counts the size only of files under `src/`, so it is not held to a zone. No doc or roadmap line names the fake's use of `memoryBytes` (searched `docs`, `spec/roadmap.md`, `packages`, `README.md`). The branch has no `findings.md`.

The new tests cover each accepted size form, the two limits (a cache at exactly the size and one byte under it), the no-flag case, 17 refused forms plus the missing value, and a test that fails if a start loads any file but the fake's own.

## Notes
- (minor) packages/docker/test/fake-docker.ts:53: the comment cites buildx's reading (`MemBytes`, `RAMInBytes`), but the fake is narrower. The real one accepts `10g`, `10GB`, `10 G`, `P` and `0`, which the fake refuses with exit 2. The same comment says the fake reads only the plugin's `buildCache` forms, so it does not mislead.
- (minor) packages/docker/test/fake-docker.ts:58: `ramBytes` accepts any number of decimals and has no 2^63 upper bound. `memoryBytes`, which checks `buildCache`, refuses both, so the fake accepts a few forms the plugin never sends. It is harmless.
- (minor) packages/docker/test/fake-docker.ts:163: before, a size the fake could not read cut nothing (`?? Infinity`); now it is refused with exit 2. That is a small change of behavior beyond the speed-up. The worker's message names it and a test covers it.

## Checks (on `39117ba8`)
- `npm run check && npm test`: `tsc` printed nothing; 1912 tests, 1848 pass, 0 fail, 64 skipped (362 s).
- `npm run mutate`: `mutate: 0 mutants, 0 caught, 0 survived` (it skips `packages/*/test/`).
- 10 hand mutations of `fake-docker.ts`, each run against `fake-shapes.test.ts`, all 10 caught, each file restored with `git checkout`:
  - the core import put back
  - the refusal turned into `?? Infinity`
  - the 1-byte limit set to `>= 0`
  - the `^` anchor removed
  - the `$` anchor removed
  - `Math.trunc` changed to `Math.round`
  - no flag treated as size `0`
  - 1024 changed to 1000
  - the `Math.max` bound removed
  - exit code 2 changed to 1
- One start, 10 runs with `NODE_DISABLE_COMPILE_CACHE=1`, measured with `/usr/bin/time`: the base fake took 1.67 CPU-s in all (0.167 per start), the tip's 1.16 CPU-s (0.116 per start). That matches the worker's 0.185 to 0.115. The throwaway copy and the `calls` file it wrote were removed; `git status` is clean.
- Not rerun: `/usr/bin/time` on `sweep.test.ts` and `cleanup.test.ts` alone.

PASS