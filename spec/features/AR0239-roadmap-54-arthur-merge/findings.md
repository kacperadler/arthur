# AR0239 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

`- Budget:` is optional: set it, in USD, only when the ticket this finding becomes is expected to cost more than the autopilot default, and leave the line out otherwise. `h merge` copies it into the ticket's JSON block as `budget`, which `h ticket status --autopilot` passes to `--budget`, capped at `H_AUTOPILOT_BUDGET_MAX`.

## F1. arthur merge installs from the lockfile and never reads a project's own install

- Kind: bug
- Found by: 2026-10-20-roadmap-54-arthur-merge-76ffc10e (worker), 2026-10-21
- Where: `packages/delivery/src/merge-checks.ts:12` (the lockfile table) and `packages/projects/src/install.ts:19` (`installCommand`, which reads `install` first)
- What: a project whose entry in `arthur.config.ts` sets `install` (a custom command, or `""` for none) gets that command in each new worktree, but `arthur merge` runs the frozen install of the changed lockfile instead (`npm ci` for `package-lock.json`), because the projects plugin exposes its install to no other plugin and delivery may not import it. A project with `install: ""` and a lockfile still gets `npm ci` on main after a merge that changed the lockfile.
- Suggestion: the projects plugin provides `projects.install` (`{ project, commit }` to the command, `""` for none), recorded in `docs/plugin-api.md`, and the merge asks it, dropping its own lockfile table; nothing else of the merge changes.
- Status: open

## F2. The checks on main run on the service's Node, not the project's .nvmrc

- Kind: risk
- Found by: 2026-10-20-roadmap-54-arthur-merge-76ffc10e (worker), 2026-10-21
- Where: `packages/delivery/src/merge-checks.ts:56` (`step`, which runs with the `arthur merge` process's PATH)
- What: a job's worktree gets the nvm plugin's Node first on PATH (its `prepare`), but the merge's install and `npm run check`/`npm test` on main run with whatever PATH the coordinator's shell has. A project pinned to another Node major in `.nvmrc` can pass in its worker and fail, or pass when it should not, on main.
- Suggestion: a provided name from the nvm plugin answering the PATH for a project's checkout (the same `nvm which` it runs for a worktree), asked by the merge before its steps; without the plugin, the PATH as it is.
- Status: open

## F3. The onboarding procedure does not name the command that merges an onboarding

- Kind: improvement
- Found by: 2026-10-20-roadmap-54-arthur-merge-76ffc10e (worker), 2026-10-21
- Where: `packages/projects/roles/coordinator/onboarding-ended.md:7`
- What: it says "merge only on the owner's word" but not how: an onboarding is never reviewed, so its merge is `arthur merge <job id> --unreviewed`, which `arthur merge --help` and the coordinator's role now say, but the procedure the coordinator gets at the onboarding's end does not.
- Suggestion: end that sentence with "`arthur merge <job id> --unreviewed`, then the committed files", in the projects package; nothing else.
- Status: open
