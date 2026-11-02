# AR0572 - Outcome

- Merged: 2026-10-30, `97e94575`
- Branch: arthur/2026-10-30-worker-27752479
- Reviews: review-1.md PASS
- Cost: worker $8.62, reviews $0.98; review rounds 1

## What went in

- .agents/arthur/criteria/review.md: a guard bypass whose write the sandbox refuses is a note; a plain command the base refused and the tip lets through is a FAIL.
- arthur.config.example.ts: shows `core.jobs.unsandboxed: false` with what it does.
- docs/deploy.md: the threat model says a job without a sandbox fails unless `core.jobs.unsandboxed: true`, and that macOS and other machines need that opt-in.
- packages/core/docs/commands/doctor.md: documents the `core sandbox` line.
- packages/core/docs/commands/remote-job.md: `add` reads `unsandboxed`.
- packages/core/docs/commands/spawn.md: the record's `unsandboxed`, the `failed: no sandbox` outcome, and the rewritten no-sandbox paragraph.
- packages/core/docs/core.md: documents `jobs.unsandboxed`.
- packages/core/src/config.ts: `jobs.unsandboxed` type and default false.
- packages/core/src/core-options.ts: the `jobs.unsandboxed` option, true or false.
- packages/core/src/job-ending.ts: a `no sandbox:` failure ends `failed: no sandbox: …`.
- packages/core/src/job-record.ts: writes the `unsandboxed` record field.
- packages/core/src/job-sandbox.ts: `sandboxed` refuses without the sandbox unless opted in; `noSandbox` exported; steps keep running bare.
- packages/core/src/jobs.ts: passes `unsandboxed` to the record here and on another machine.
- packages/core/src/remote-job.ts: `add` writes `unsandboxed` into the record there.
- packages/core/src/requirements.ts: the `core sandbox` doctor requirement naming the opt-in.
- packages/core/src/testing.ts: the kit's runner turns `unsandboxed` on.
- packages/core/src/wrapper.ts: reads `unsandboxed`; a refusal ends the job before the install or the agent starts.
- packages/core/test/commands.test.ts: fixture opts in.
- packages/core/test/config.test.ts: the option's default, kept value, unknown-option list and wrong type.
- packages/core/test/doctor.test.ts: the `core sandbox` line missing and opted in; CLI configs opt in.
- packages/core/test/env.test.ts: fixture opts in.
- packages/core/test/events.test.ts: fixture opts in.
- packages/core/test/host.test.ts: fixture opts in.
- packages/core/test/job-control.test.ts: runner and CLI config opt in.
- packages/core/test/job-records.test.ts: runner and CLI config opt in.
- packages/core/test/job-state.test.ts: runner opts in.
- packages/core/test/jobs.test.ts: runner opts in.
- packages/core/test/limits.test.ts: runner opts in.
- packages/core/test/machine.test.ts: a job on another machine without the sandbox fails there unless opted in here.
- packages/core/test/model.test.ts: runner opts in.
- packages/core/test/roles.test.ts: runner opts in.
- packages/core/test/run.test.ts: config opts in, so `arthur run`'s doctor misses nothing on a host without the sandbox.
- packages/core/test/sandbox.test.ts: refusal unless opted in (unit and job level, install included); missing-agent exemption; steps need no opt-in.
- packages/core/test/scope.test.ts: runner opts in.
- packages/core/test/secret-names.test.ts: CLI config opts in.
- packages/core/test/setup.test.ts: configs opt in; Requirements slice moved past the new core line.
- packages/core/test/spawn.test.ts: CLI config opts in.
- packages/core/test/worktree-guard.test.ts: runners opt in.
- packages/core/test/wrapper.test.ts: runners opt in.
- test/structure.test.ts: core line budget 6503 → 6518.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1317/1385 passed.

## Left open

- Deferred (client summary): F1. a `python3` that exits 127 itself gets past the refusal
