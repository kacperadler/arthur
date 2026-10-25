# AR0354 - The mark that tells a job from the coordinator is a variable the job's shell clears

```json
{
  "id": "AR0354",
  "title": "The mark that tells a job from the coordinator is a variable the job's shell clears",
  "date": "2026-10-23"
}
```

## Description

each refusal reads `process.env.ARTHUR_JOB`, and the job's `bash` sets the environment of what it runs: `env -u ARTHUR_JOB arthur decision …`, `ARTHUR_JOB= arthur youtrack issue tag …`, `unset ARTHUR_JOB; arthur plugin new …` pass the env guard and the worktree guard (probe: `passes` for each), and the CLI then sees no job: with the variable cleared on the line, `arthur decision ask` in the temporary folder recorded `AC-D1`. The existing tests prove the refusal with the variable set and its absence with the variable deleted (`decisions.test.ts:644-651`), which is the same path a job takes. F1's gate on the same mark would hold against a mistake, not against a steered job.

## Goal

A job is told from the coordinator by something its shell cannot clear (not only `ARTHUR_JOB`), so the refusals of AR0353 hold; tested.

- Kind: security

Evidence:
- `packages/core/src/wrapper.ts:129` (`ARTHUR_JOB` set for the agent); read at `packages/orchestration/src/decision-commands.ts:62`, `packages/youtrack/src/youtrack-command.ts:63`, `packages/develop/src/plugin-new.ts:50`; the scope `packages/core/src/job-scope.ts:27`, `:63` and the bare run `:56-60`
- Found by: 2026-10-23-ar0323-security-check-4d9a06d2 (worker), 2026-10-23

## Done means

- The fix, with a test that proves it: one function in the core, `insideJob(): string | undefined`, the job's id from something the process cannot change: `/proc/self/cgroup`'s last line ending in `/arthur-job-<id>.scope` (the unit `launch` makes, `job-scope.ts:27`), else `ARTHUR_JOB`'s record folder name when the job runs bare (no systemd here, or a machine without it), which `docs/deploy.md`'s threat model names as the weaker case; the three refusals and F1's gate read it, and nothing else reads `ARTHUR_JOB` for a refusal. Tests: a `/proc/self/cgroup` text with the scope line, with another unit, with none; the variable cleared while the cgroup names a job still refuses (the function takes the cgroup text and the environment as arguments, so no real scope is needed); `scope.test.ts` already starts a real scope and can assert the function's answer inside it, under systemd only. Out: a sandbox that keeps a job out of the config folder altogether (AR0320 F1), which makes the mark moot for the CLI.
- `npm test` and `npm run check` pass.

## Scope

In:
- one function in the core, `insideJob(): string | undefined`, the job's id from something the process cannot change: `/proc/self/cgroup`'s last line ending in `/arthur-job-<id>.scope` (the unit `launch` makes, `job-scope.ts:27`), else `ARTHUR_JOB`'s record folder name when the job runs bare (no systemd here, or a machine without it), which `docs/deploy.md`'s threat model names as the weaker case; the three refusals and F1's gate read it, and nothing else reads `ARTHUR_JOB` for a refusal. Tests: a `/proc/self/cgroup` text with the scope line, with another unit, with none; the variable cleared while the cgroup names a job still refuses (the function takes the cgroup text and the environment as arguments, so no real scope is needed); `scope.test.ts` already starts a real scope and can assert the function's answer inside it, under systemd only. Out: a sandbox that keeps a job out of the config folder altogether (AR0320 F1), which makes the mark moot for the CLI.

## Decisions

- 2026-10-23: Source: F2 of AR0323
- 2026-10-23: Coordinator (free hand, finding ticket) approved; starts after the ten security checks AR0319-AR0328.
- 2026-10-26: AR0354 home check accepted under AR-D31; F1 settled as a ticket at merge; the owner: "always go with recommendation till the 8 am morning" (AR-D46)
