# AR0384 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

`- Budget:` is optional: set it, in USD, only when the ticket this finding becomes is expected to cost more than the autopilot default, and leave the line out otherwise. `h merge` copies it into the ticket's JSON block as `budget`, which `h ticket status --autopilot` passes to `--budget`, capped at `H_AUTOPILOT_BUDGET_MAX`.

## F1. A `git fetch` or `git push` from a job's worktree into `refs/replace` still writes a replacement every worktree reads

- Kind: security
- Found by: 2026-10-25-ar0384-git-replace-ee20b11a (worker), 2026-10-25
- Where: `packages/core/src/worktree-guard.ts:138-152` (a `fetch` or `push` is judged only by the folder it runs in, and the job's own worktree passes)
- What: with `git replace` refused, the same ref still arrives by a refspec. In a temporary repository with a job worktree `w` of main checkout `m`: `git -C w fetch . "HEAD:refs/replace/$(git -C m rev-parse main)"` made `git -C m replace -l` list main's tip and `git -C m status --short` show `M  f`; after `git -C m replace -d <tip>`, `git -C w push . "HEAD:refs/replace/<tip>"` wrote it again. A refspec in a remote's config (`git remote add --mirror=fetch`, `-c remote.<name>.fetch=…`, `git config --worktree remote.<name>.fetch …`) would do the same without naming `refs/replace` on the command line [INFERENCE: not run]. Arthur's own git calls with the hookless `-c` flags read past it (AR0384); the human's git commands in the main checkout, and the reads of F2, do not.
- Suggestion: either set `core.useReplaceRefs=false` in each project's shared config (every worktree then reads past a replacement, whatever wrote it; it changes the user's repository config and turns off replacements the human may use, so it is the owner's call, and `git-config.ts`'s allowed set would need the key), or refuse in the guard a `fetch` or `push` whose words name a destination under `refs/replace` (an explicit `…:refs/replace/…`, a glob destination that covers it such as `refs/*`), naming the config-defined refspecs as a limit.
- Status: open

## F2. Arthur's other git reads in a main checkout still read through a replacement

- Kind: security
- Found by: 2026-10-25-ar0384-git-replace-ee20b11a (worker), 2026-10-25
- Where: `packages/orchestration/src/plans.ts:62` and `:92`, `packages/commit-rules/src/commit-rules.ts:43`, `packages/projects/src/install.ts:21`, `packages/projects/src/onboarding.ts:67`, `packages/findings/src/findings-command.ts:56`, `packages/manage/src/audit.ts:25`, `packages/manage/src/retro-due.ts:29`, `packages/manage/src/health-checks.ts:31`, `packages/session/src/restart-guard.ts:18`, `packages/delivery/src/ci-wait.ts:45`
- What: these `git -C <root> …` calls have neither the hookless `-c` flags of AR0330 nor `--no-replace-objects`, so a replacement under `refs/replace` (F1) changes what they read of a commit: a plan's ticket at HEAD, a commit rule's file at the job's base, the lockfile `projects.install` picks for a merge, an onboarding branch's diff. AR0384 gave the flag only to the calls with the `-c` flags, and to `fileAt` (git.ts), which a review's spawn needed.
- Suggestion: give each of these calls `--no-replace-objects` (and the hookless `-c` flags where the call may run a hook or fsmonitor), with a test per package that plants a replacement before the read.
- Status: open
