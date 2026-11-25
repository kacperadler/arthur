# AR0742 - npm run mutate leaves test jobs' wrapper and agent processes running under /tmp/arthur-test-*

```json
{
  "id": "AR0742",
  "title": "npm run mutate leaves test jobs' wrapper and agent processes running under /tmp/arthur-test-*",
  "date": "2026-11-25"
}
```

## Description

When `npm run mutate` ends or cuts a test run, test jobs that the tests started (their `wrapper.ts`, a fake agent, an `omp --continue` session) keep running under `/tmp/arthur-test-*`. They use CPU and memory until someone kills them by hand. After this change, mutate leaves no test process behind.

## Goal

Seen 3 times on 2026-11-25. The AR0739 worker reported 6 leftover processes. The AR0739 review found 4 after its 4 mutate calls: 2 `wrapper.ts` and 2 `omp --continue` coordinator sessions. The AR0740 worker found 2 after its last call (`wrapper.ts` pid 1178419 and `fake-agent.ts` pid 1178559, job `2026-10-16-worker-2df43514` under `/tmp/arthur-test-fpGkQV/`, running 4:36). Each was killed by hand. [INFERENCE] The wrapper is started `detached` (`packages/core/src/job-scope.ts:68`), so it is outside the process group that `test/mutate.ts` kills when a run ends or times out.

- Kind: fix

## Done means

- After a mutate run that is cut by its time limit, no process whose arguments name that run's `/tmp/arthur-test-*` folder is still running. A test in `test/` (mutate's own test) starts a detached child the way a test job does, cuts the run, and checks the child is gone. It fails on main and passes after the change.
- `npm run check`, `npm test` and `npm run mutate` pass.

## Scope

In:
- `test/mutate.ts`: the cleanup when a test run ends or is cut.
- `test/mutate.test.ts`: the test above.

Out:
- The wrapper's `detached: true` stays; AR0741 adds its test.

## Decisions

<!-- - YYYY-MM-DD: one decision the human made, in one line. -->
