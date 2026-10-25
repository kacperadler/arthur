# AR0379 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

`- Budget:` is optional: set it, in USD, only when the ticket this finding becomes is expected to cost more than the autopilot default, and leave the line out otherwise. `h merge` copies it into the ticket's JSON block as `budget`, which `h ticket status --autopilot` passes to `--budget`, capped at `H_AUTOPILOT_BUDGET_MAX`.

## F1. A job on another machine moves a Git LFS project's commits there and back without their LFS objects

- Kind: fix
- Found by: 2026-10-24-ar0379-lfs-push-58ca3d44 (worker), 2026-10-25
- Where: `packages/core/src/job-machine.ts:152` (`gitOver` push of the base commit), `packages/core/src/machine-sync.ts:71` (fetch of the branch back)
- What: [INFERENCE] from Git LFS's documented behavior; `git lfs` is not installed on this machine, so nothing was run. The base commit goes to the machine's bare repository by `git push` with no hook, so no LFS object goes with it, and the worktree there checks out pointers or tries the LFS endpoint the machine's remote URL implies. A branch made there comes back by `git fetch`, which brings pointers only; its large files stay in the machine's `.git/lfs`. `github.push` of that branch then runs `git lfs push origin`, which cannot find the objects locally and refuses, so the branch is not pushed (AR0379 makes that a refusal, not a push of pointers).
- Suggestion: for a project whose `.gitattributes` names `filter=lfs`, run `git lfs push` to the machine's repository after the base push and `git lfs fetch` from it after the branch fetch, or refuse to place such a project on another machine and say so in `docs/deploy.md`. Out: pushes to origin (AR0379).
- Status: ticket AR0390

## F2. The 60 s limit of a push also bounds its LFS upload

- Kind: fix
- Found by: 2026-10-24-ar0379-lfs-push-58ca3d44 (worker), 2026-10-25
- Where: `packages/github/src/github-git.ts:9` (`PUSH_MS`)
- What: `github.push` kills `git lfs push origin <ref>` after 60 s, as it kills `git push`. A branch whose new large files take longer to upload is never pushed: each PASS, `no review` or merge starts the upload again and is killed again ([INFERENCE] that git-lfs resumes nothing across runs of a killed upload; not run).
- Suggestion: a limit for the LFS upload that ends on no progress rather than on a fixed time, or a larger one for it alone; the `git push` limit stays.
- Status: ticket AR0391

## F3. The `.gitattributes` gate differs from git-lfs's own pre-push hook

- Kind: docs
- Found by: 2026-10-24-review-ar0379-lfs-push-0f96b129 (review), 2026-10-24
- Where: `packages/github/src/github-git.ts`
- What: Arthur runs `git lfs push` only when a `.gitattributes` in the tip names `filter=lfs`; git-lfs's hook relies on install-time registration instead. Matches the ticket's Done means.
- Suggestion: none.
- Status: dropped (matches the ticket as written; the reviewer called it no deviation)
