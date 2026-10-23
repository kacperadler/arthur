# AR0373 - The install of a new worktree and the merge's steps run outside every job scope, with lifecycle scripts on (AR0311 F14, confirmed)

```json
{
  "id": "AR0373",
  "title": "The install of a new worktree and the merge's steps run outside every job scope, with lifecycle scripts on (AR0311 F14, confirmed)",
  "date": "2026-10-23"
}
```

## Description

a dependency's lifecycle script (`preinstall`, `postinstall`, `prepare`), at every spawn of a project whose lockfile names one and at every merge, and the project's own `check` and `test` scripts at every merge, run as Arthur with the service's whole CPU and memory, outside `arthur-jobs.slice`, and a process one of them leaves behind outlives the spawn and the merge; nothing records that it ran there. Today Arthur's own lockfile has no package with an install script (`hasInstallScript` on none of its 23 entries); a client project's may.

## Goal

The install of a new worktree and the merge's steps run inside a job scope, with lifecycle scripts off unless a project turns them on; tested.

- Kind: security

Evidence:
- `packages/projects/src/install.ts:36-37` (the install through `host.jobs.run`), `packages/core/src/jobs.ts:182` and `:190` (the prepares run, then `launch` creates the scope), `packages/core/src/job-machine.ts:89-106` (`execute`: a plain `spawn` in Arthur's process, or `ssh` on another machine), `packages/delivery/src/merge-checks.ts:63` (`spawnSync("sh", ["-c", command])` in the process of `arthur merge`), `install.ts:10-14` (the lockfile commands, none with `--ignore-scripts`)
- Found by: 2026-10-23-ar0328-security-check-41d0fc72 (worker), 2026-10-23

## Done means

- The fix, with a test that proves it: run the install as the first step of the wrapper, inside the job's scope, so the caps and `endScope` cover it (the spawn's refusal on a failed install then becomes the job ending `failed` at once, its worktree kept, which `docs/commands/projects.md`, "Install", would say); run the merge's steps in a transient scope of their own under the jobs' slice (`systemd-run --user --scope --slice=arthur-jobs.slice`, as `job-scope.ts` starts a job) when a user manager exists, bare with one `uncapped` line otherwise. Leave `--ignore-scripts` out: a project's build needs its scripts, and the scope is what bounds them. Tests: `scope.test.ts` under `needsManager`: a fake install that prints `/proc/self/cgroup` lands in `arthur-job-<id>.scope` and a daemon it forks is gone once the job ends; `merge.test.ts`: a `test` script that forks a sleeper leaves no process once `arthur merge` printed its last line.
- `npm test` and `npm run check` pass.

## Scope

In:
- run the install as the first step of the wrapper, inside the job's scope, so the caps and `endScope` cover it (the spawn's refusal on a failed install then becomes the job ending `failed` at once, its worktree kept, which `docs/commands/projects.md`, "Install", would say); run the merge's steps in a transient scope of their own under the jobs' slice (`systemd-run --user --scope --slice=arthur-jobs.slice`, as `job-scope.ts` starts a job) when a user manager exists, bare with one `uncapped` line otherwise. Leave `--ignore-scripts` out: a project's build needs its scripts, and the scope is what bounds them. Tests: `scope.test.ts` under `needsManager`: a fake install that prints `/proc/self/cgroup` lands in `arthur-job-<id>.scope` and a daemon it forks is gone once the job ends; `merge.test.ts`: a `test` script that forks a sleeper leaves no process once `arthur merge` printed its last line.

## Decisions

- 2026-10-23: Source: F1 of AR0328
- 2026-10-23: Coordinator (free hand, finding ticket) approved; starts after the ten security checks AR0319-AR0328.
