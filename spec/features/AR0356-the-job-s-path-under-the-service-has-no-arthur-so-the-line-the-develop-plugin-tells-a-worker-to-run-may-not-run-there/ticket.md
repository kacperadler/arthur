# AR0356 - The job's `PATH` under the service has no `arthur`, so the line the develop plugin tells a worker to run may not run there

```json
{
  "id": "AR0356",
  "title": "The job's `PATH` under the service has no `arthur`, so the line the develop plugin tells a worker to run may not run there",
  "date": "2026-10-23"
}
```

## Description

read from the docs, not run here (no VPS): under the unit of `docs/setup.md`, a worker's `bash` finds no `arthur` on its `PATH`, so the one line a role tells a job to run would answer `command not found`, and a worker on a new plugin's ticket would stop or make the package by hand, which the section forbids. The coordinator is not affected: its tmux shell reads `~/.bashrc`. [INFERENCE] from those lines; whether omp's `bash` tool starts a login shell that reads `~/.bashrc` was not checked.

## Goal

Under the systemd service a job's `PATH` has `arthur`, so the line the develop plugin gives a worker runs; tested or documented in setup.

- Kind: bug

Evidence:
- `docs/setup.md:112` (the service's `PATH`: Node's bin, `~/.local/bin`, the system folders; `~/arthur/node_modules/.bin` goes into `~/.bashrc` only, `:53-54`), `packages/core/src/job-scope.ts:68` and `packages/core/src/wrapper.ts:129` (the job gets `arthur run`'s environment), `packages/develop/src/plugin-new.ts:130` (`cd <checkout> && arthur plugin new …` in the worker's prompt), `packages/develop/test/plugin-new.test.ts:231` (the test puts `<checkout>/node_modules/.bin` on `PATH` itself)
- Found by: 2026-10-23-ar0323-security-check-4d9a06d2 (worker), 2026-10-23

## Done means

- The fix, with a test that proves it: have the section say the path the CLI is at, `<checkout>/node_modules/.bin/arthur`, instead of `arthur`, or have `launch` put the folder of its own `process.argv[1]`'s bin on the job's `PATH`; a test in `plugin-new.test.ts:230` that runs the line with the service's `PATH` of `docs/setup.md:112` (no `node_modules/.bin`). Out: F1, which decides whether a job may run the CLI at all; this entry is about the one line a role already tells it to run.
- `npm test` and `npm run check` pass.

## Scope

In:
- have the section say the path the CLI is at, `<checkout>/node_modules/.bin/arthur`, instead of `arthur`, or have `launch` put the folder of its own `process.argv[1]`'s bin on the job's `PATH`; a test in `plugin-new.test.ts:230` that runs the line with the service's `PATH` of `docs/setup.md:112` (no `node_modules/.bin`). Out: F1, which decides whether a job may run the CLI at all; this entry is about the one line a role already tells it to run.

## Decisions

- 2026-10-23: Source: F4 of AR0323
- 2026-10-23: Coordinator (free hand, finding ticket) approved; starts after the ten security checks AR0319-AR0328.
