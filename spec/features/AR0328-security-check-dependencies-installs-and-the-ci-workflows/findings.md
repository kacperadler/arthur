# AR0328 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

`- Budget:` is optional: set it, in USD, only when the ticket this finding becomes is expected to cost more than the autopilot default, and leave the line out otherwise. `h merge` copies it into the ticket's JSON block as `budget`, which `h ticket status --autopilot` passes to `--budget`, capped at `H_AUTOPILOT_BUDGET_MAX`.

Every entry comes from `check.md` beside this file, which holds the rows and how each was checked. Each is written as a missing check: the input the code does not cover and the check that would.

## F1. The install of a new worktree and the merge's steps run outside every job scope, with lifecycle scripts on (AR0311 F14, confirmed)

- Kind: risk
- Severity: low
- Found by: 2026-10-23-ar0328-security-check-41d0fc72 (worker), 2026-10-23
- Where: `packages/projects/src/install.ts:36-37` (the install through `host.jobs.run`), `packages/core/src/jobs.ts:182` and `:190` (the prepares run, then `launch` creates the scope), `packages/core/src/job-machine.ts:89-106` (`execute`: a plain `spawn` in Arthur's process, or `ssh` on another machine), `packages/delivery/src/merge-checks.ts:63` (`spawnSync("sh", ["-c", command])` in the process of `arthur merge`), `install.ts:10-14` (the lockfile commands, none with `--ignore-scripts`)
- Rule: installs and merge checks run with the least they need: a job's scope with the joint slice's `cpu` and `memory`, and an end that kills what they leave.
- What: a dependency's lifecycle script (`preinstall`, `postinstall`, `prepare`), at every spawn of a project whose lockfile names one and at every merge, and the project's own `check` and `test` scripts at every merge, run as Arthur with the service's whole CPU and memory, outside `arthur-jobs.slice`, and a process one of them leaves behind outlives the spawn and the merge; nothing records that it ran there. Today Arthur's own lockfile has no package with an install script (`hasInstallScript` on none of its 23 entries); a client project's may.
- Suggestion: run the install as the first step of the wrapper, inside the job's scope, so the caps and `endScope` cover it (the spawn's refusal on a failed install then becomes the job ending `failed` at once, its worktree kept, which `docs/commands/projects.md`, "Install", would say); run the merge's steps in a transient scope of their own under the jobs' slice (`systemd-run --user --scope --slice=arthur-jobs.slice`, as `job-scope.ts` starts a job) when a user manager exists, bare with one `uncapped` line otherwise. Leave `--ignore-scripts` out: a project's build needs its scripts, and the scope is what bounds them. Tests: `scope.test.ts` under `needsManager`: a fake install that prints `/proc/self/cgroup` lands in `arthur-job-<id>.scope` and a daemon it forks is gone once the job ends; `merge.test.ts`: a `test` script that forks a sleeper leaves no process once `arthur merge` printed its last line.
- Status: open

## F2. The install at a spawn and each step of the merge have no time limit

- Kind: risk
- Severity: medium
- Found by: 2026-10-23-ar0328-security-check-41d0fc72 (worker), 2026-10-23
- Where: `packages/projects/src/install.ts:37` (`host.jobs.run(job.machine, [...])` with no `limitSeconds`), `packages/core/src/job-machine.ts:102` (the timer only when one is given; the nvm prepare beside it passes `LIMIT_SECONDS`, `packages/nvm/src/nvm.ts:11`, `:57`), `packages/delivery/src/merge-checks.ts:63` (`spawnSync` with `maxBuffer` but no `timeout`)
- Rule: installs and merge checks run with the least they need, time included: a step that does not end is a failed step.
- What: an install that waits (a registry that never answers, a lifecycle script that reads stdin or sleeps) holds `arthur spawn` open for ever, with the job's worktree and record already written and no scope to kill it; a `check` or `test` script on main that hangs holds `arthur merge` open with the merge commit already on main, nothing filed, nothing reset, until someone kills the process by hand; the refusals a second `arthur merge` makes meanwhile (`merge-command.ts:59-80`: no branch, no identity, a dirty or detached main, nothing new) name no merge in progress, so by those lines it would merge on top of the unchecked commit (not run). Nothing in the code covers a step that does not return.
- Suggestion: a limit on both, as one number in the delivery and projects options or a constant each (the install: `limitSeconds` to `host.jobs.run`, which already kills and reports `timed out after <n> s`; the merge: `timeout` and `killSignal: "SIGKILL"` to `spawnSync`, a step whose `ran.signal` is set reported `failed, timed out after <n> s.`), named in `docs/commands/projects.md`, "Install", and `docs/commands/merge.md`, "Checks on main". Tests: `install.test.ts`, a fake install that sleeps past a one-second limit refuses the spawn with `timed out after 1 s` and leaves no worktree or record; `merge.test.ts`, a `test` script that sleeps past the limit is a failed step, main reset, main's install put back.
- Status: open

## F3. The CI workflows set no `permissions` and pin actions and the site's runner by tag (AR0311 F16, confirmed)

- Kind: risk
- Severity: low
- Found by: 2026-10-23-ar0328-security-check-41d0fc72 (worker), 2026-10-23
- Where: `.github/workflows/ci.yml:1-21` (no `permissions:` at any level; `actions/checkout@v4`, `actions/setup-node@v4` at `:11-12`), `.github/workflows/site.yml:9-25` (the `build` job: no `permissions:`, `ubuntu-latest` at `:10`, the same two actions at `:15-16`, `actions/upload-pages-artifact@v5` at `:23`; `npm ci` of the site's 466 packages at `:21`), `:30` (`ubuntu-latest` of `deploy`), `:42` (`actions/deploy-pages@v5`)
- Rule: the CI workflows set the token's permissions and pin actions.
- What: `GITHUB_TOKEN` of the `check` and `build` jobs is whatever the repository's Actions setting makes the default, which the workflow does not state, and a tag `@v4`/`@v5` is whatever the action's repository points it at on the day; the site's `build` job runs the lifecycle scripts of 466 packages (`fsevents` has one today) with that token on every push and pull request. No test reads `.github/`, so a workflow that loses its `permissions` block or a pin later is not caught.
- Suggestion: `permissions: contents: read` at the top of both workflows (`deploy` keeps its own `pages: write`, `id-token: write`); each `uses:` pinned to the action's commit with the tag as a comment (`actions/checkout@<sha> # v4`); `runs-on: ubuntu-24.04` in `site.yml` as in `ci.yml`. Test: in `test/structure.test.ts`, over `.github/workflows/*.yml` as this repository has them: each file has a top-level `permissions:` and every `uses:` is `@<40 hex>`, which fails when either is removed. Out: a Dependabot or Renovate config for the pins and the site's dependencies, a decision of the owner's.
- Status: open
