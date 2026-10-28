# AR0456 - Review 1

- Job: 2026-10-28-review-5bc597c2
- Branch: arthur/2026-10-28-worker-0197a47f
- Commit reviewed: 77566cacc6c3866f6529d96169e8121c04802d86
- Verdict: PASS

## Final message

I found nothing that blocks the merge. The branch does what AR0456 asks, the new test catches the bug when the fix is removed, and `npm ci`, `npm run check` and `npm test` all pass when I run them myself.

**Findings**

None.

**Notes (not blocking)**
- `packages/core/src/wrapper.ts:129`: the agent now starts with `npm_config_cache` set to the job record's `cache/npm`, written after the inherited environment, so it wins over the environment's own value. The ticket's Scope allows the job's environment to be set in this file instead of `job-sandbox.ts`. The file is at exactly 200 lines.
- If Arthur's environment holds only the upper-case `NPM_CONFIG_CACHE`, the lower-case setting the worker adds still wins. I checked this outside the sandbox: with both set, `npm config get cache` printed the lower-case value, `/tmp/lower-x`. The new test only covers the lower-case name. Even if the upper-case one won, the sandbox keeps the shared `~/.npm` read-only, so the worst case is an `EACCES` error, never a written shared cache.
- A project's `.npmrc` `cache=` cannot take the cache back, because npm ranks environment settings above project config.
- I hit finding F2 in this review: reading `proc://bg_1` failed with `connect EACCES …/broker.sock`.
- The finding F1 (bun, pnpm, uv and composer caches) is a reasonable deferral: the ticket asks only for npm.
- The ticket's three "Done means" points are met:
  - The agent's npm cache is a writable folder private to the job.
  - The test shows `npm ci` writing it while the stand-in shared cache stays empty.
  - `spawn.md` has a new paragraph saying where the cache is.
- No client or other project is named in the new `findings.md`, and the test uses its own temporary folders.

**Checks run**
- `npm ci`: exit 0.
- `npm run check` (`tsc`): exit 0.
- New test, run alone (`node --test --test-name-pattern="npm ci itself" packages/core/test/sandbox.test.ts`): 1 passed, not skipped (the sandbox is available here).
- **Mutation 1:** I removed `npm_config_cache` from the agent's environment in `wrapper.ts`. The test failed with `npm error code EACCES … user/.npm/_cacache` and `exit 243`, which matches what the worker reported. I restored the file.
- **Mutation 2:** I moved `npm_config_cache` in front of `...process.env`, so the inherited value overrides it. The test failed. I restored the file.
- `npm test`: 1227 tests, 1166 passed, 0 failed, 61 skipped. The worker's flaky merge-step test (F3) passed in this run.
- `git status` was clean after the mutations were restored.

PASS