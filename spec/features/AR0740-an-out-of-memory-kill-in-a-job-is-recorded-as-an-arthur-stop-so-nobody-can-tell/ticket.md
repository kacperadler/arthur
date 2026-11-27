# AR0740 - An out-of-memory kill in a job is recorded as an arthur stop, so nobody can tell a test that ate 16 GB from a person stopping the job

```json
{
  "id": "AR0740",
  "title": "An out-of-memory kill in a job is recorded as an arthur stop, so nobody can tell a test that ate 16 GB from a person stopping the job",
  "date": "2026-11-24"
}
```

## Description

When the kernel's out-of-memory killer ends a process in a job's scope, systemd then stops the scope with SIGTERM, and the wrapper takes any SIGTERM as `arthur stop`. The job ends `stopped`, its log says `arthur stop: stopping the agent`, and the coordinator and the owner read it as a person's stop. On 2026-11-24 this hid three OOM kills, and the coordinator asked the owner whether he had stopped the job.

## Goal

Evidence, 2026-11-24 (Europe/Warsaw times = UTC+1):

- `journalctl -k`: at 19:16:45, 19:31:48 and 19:48:05 UTC, `Memory cgroup out of memory: Killed process ... (bun) ... anon-rss:16654488kB` (then 15738628kB, 15659836kB), `oom_memcg=.../arthur.slice/arthur-jobs.slice`, task in `arthur-job-2026-11-24-worker-9d8363b7.scope` (twice) and `arthur-job-2026-11-24-review-bd7639ee.scope`.
- `journalctl --user`: `arthur-job-2026-11-24-worker-9d8363b7.scope: Failed with result 'oom-kill'` two seconds later.
- The job logs: `[arthur 2026-11-24T19:16:47.175Z] arthur stop: stopping the agent`, then `ended: stopped`. `.arthur/events.jsonl` has no `command-ran` of `stop` for these jobs.
- `packages/core/src/wrapper.ts:109`: `process.on("SIGTERM", () => halt("stop"))`; every SIGTERM is `arthur stop`.
- A single test process took 16 GB because the joint slice (`arthur-jobs.slice`, `MemoryMax=17633566720`) was the only memory limit: no per-job cap stopped it before it reached the cap of all jobs together, so any other job's process could have been the one killed.

- Kind: fix

## Done means

- A job whose scope had an OOM kill ends with a reason that names memory (as `limit: memory: ...` does), not `stopped`, and its log names the killed process and its size; a test that runs an allocation past a small scope cap fails before the change and passes after.
- A real `arthur stop` still ends `stopped`, its test unchanged.
- `arthur spawn --help` and `arthur stop --help` say how an OOM kill ends a job.
- `npm run check`, `npm test` and `npm run mutate` pass.

## Scope

In:
- `packages/core/src/wrapper.ts` and the code that reads the scope's result (`job-scope.ts`), with their tests.
- `packages/core/docs/commands/spawn.md`, `stop.md`.

Out:
- A per-job memory cap by default (`resources` `perJob.memory`, the owner's setting): a separate decision.

## Decisions

- 2026-11-24: AR0740 approved: an out-of-memory kill in a job ends with a memory reason naming the process, at a budget of $10; the owner: "another project's decision 1, AR-D731 1" (AR-D731)
- 2026-11-25: AR0740 budget raised to $16 in total; it runs check, test and mutate on its tip after the weekly usage reset; the owner: "AR-D732: raise" (AR-D732)
