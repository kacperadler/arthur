# AR0447 - An `arthur merge` an agent runs never gets a scope of its own

```json
{
  "id": "AR0447",
  "title": "An `arthur merge` an agent runs never gets a scope of its own",
  "date": "2026-10-26"
}
```

## Description

F1 of AR0373 (spec/features/AR0373-the-install-of-a-new-worktree-and-the-merge-s-steps-run-outside-every-job-scope-with-lifecycle-scripts-on-ar0311-f14-confirmed/findings.md).

- Kind: security
- Found by: 2026-10-26-worker-9f5b347e (worker), 2026-10-26
- Where: `packages/delivery/src/merge-checks.ts` (`stepRunner`'s probe), `packages/core/docs/commands/spawn.md:116` (the sandbox makes no Unix socket)
- What: inside a job's sandbox `systemd-run --user` cannot reach the user manager's bus (`systemd-run --user --scope --quiet true` in this job printed `Failed to connect to bus: Permission denied`), so an `arthur merge` that the coordinator's agent runs takes the bare path, with its `uncapped:` line: its steps run in the coordinator's own scope, under that job's caps, and what they leave running lives until the coordinator's job ends, not until the step ends. [INFERENCE: the coordinator's agent runs in the same sandbox as this worker's; not run against a coordinator.]
- Suggestion: have the bare path inside a job kill what each step left in the job's own scope (the processes of `ownScope` started after the step, as `endScope` does), or run the steps through the host's service; out: opening the bus to the sandbox.

## Goal

<!-- What we are after, what it moves in spec/vision.md, and the evidence (file:line, a command and its output). -->

- Kind: security

## Done means

<!-- Each observable result, and the test that proves it; the project's checks pass. -->

## Scope

In:
<!-- - `path/to/file.ts`: what changes there. -->

Out:
<!-- - What this ticket does not do, and which ticket does. -->

## Decisions

- 2026-10-26: Source: F1 of AR0373
