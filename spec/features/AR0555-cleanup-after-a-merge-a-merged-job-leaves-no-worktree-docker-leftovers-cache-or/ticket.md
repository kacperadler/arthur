# AR0555 - Cleanup after a merge: a merged job leaves no worktree, Docker leftovers, cache, or branch here or on GitHub

```json
{
  "id": "AR0555",
  "title": "Cleanup after a merge: a merged job leaves no worktree, Docker leftovers, cache, or branch here or on GitHub",
  "date": "2026-10-29"
}
```

## Description

The owner, 2026-10-29: "cleanup after task is merge ... should clean things after task is done, i mean clean worktree, docker, cache, delete branch locally and remotly ect, bcs right now i have many branches on github."

What exists: `arthur prune` removes the job's worktree (`git worktree remove`), deletes the local branch (`git branch -d`), and runs every plugin's `host.jobs.cleanup` hook first; the `docker` plugin uses that hook for the job's containers, volumes, networks, images and the build cache cap. What is missing: the github plugin pushes a branch to origin after a review's PASS or a `no review` (`github.push`, packages/github/docs/github.md), and nothing ever deletes it there. On 2026-10-29 origin holds 138 `arthur/*` branches. Also, a prune runs only when the coordinator calls it; a merged job whose prune was forgotten keeps everything.

## Goal

Once a job's work is merged, or its ticket dropped, nothing of it stays: worktree, local branch, Docker resources, its cache folders, and its branch on origin.

- Kind: feat
- Plan: yes

## Done means

- Home: the github plugin deletes, through the core's existing `host.jobs.cleanup` hook, the origin branch it pushed for that job, only when origin's tip is the one it pushed or one main already contains, and never `main` or a branch not named `arthur/<job id>`; a refused or failed delete is a notice and never keeps the worktree (as docker's cleanup). No new plugin and no new core step: the planner confirms this home or names why another is smaller.
- After `arthur merge` goes in, the merged worker is pruned by the merge itself, or the merge's procedure ends with the prune, so it is not left to memory (the planner picks the smaller).
- A dropped ticket's jobs are cleaned the same way.
- `arthur github sweep-branches` (or a doctor line with its fix) deletes the `arthur/*` branches on origin whose job is gone and whose tip main contains, and lists those it kept and why; the 138 present today are its first run, with the owner's word.
- Job cache folders outside the worktree, if any, are named by the plan and removed with it; none found means the plan says so.
- Tests: each refusal (tip moved, not merged, `main`, a foreign name), a failed delete that still frees the worktree, a repeated prune.
- `npm run check` and `npm test` pass.

## Scope

In:
- `packages/github/` (cleanup hook, sweep), `packages/delivery/` (prune at merge) if the plan picks it, their docs and tests.

Out:
- GitHub pull requests and issues: AR0556.
- Docker's own cleanup: already in the docker plugin.

## Decisions
- 2026-10-29: AR0555 approved: a planner writes the plan, then it is built; the owner: "AR-D301 1 but should be also able to create pull requests and issues" (AR-D301)
- 2026-10-29: Plan approved by the owner: plan.md at 7ee53d43; the owner: "AR-D328 1" (AR-D328)
- 2026-10-29: Start AR0555 (cleanup after a merge) once AR0557 merges; AR-D330 stop otherwise stands; the owner: "Go with clinup after merge" (AR-D333)
- 2026-10-29: AR0555: github line budget 870 -> 951, delivery 1686 -> 1723, as the plan approved in AR-D328; the owner: "AR-D328 1" (AR-D335)
- 2026-10-29: AR0555: another round; the worker fixes the drop keeping a handed-back worker, then review round 3; the owner: "AR-D336 another round" (AR-D336)
- 2026-10-29: AR0555: delivery line budget 1723 -> 1728, as the plan approved in AR-D328; the owner: "AR-D328 1" (AR-D338)
- 2026-10-29: AR0555: another round; the worker fixes the wake for a dropped ticket review and tests the merge ending hand-backs, then review round 4; the owner: "AR-D340 - Another round" (AR-D340)
- 2026-10-29: AR0555 worker: if it stops at its budget, continue it with a budget of $35; the owner: "go with recommendations" (AR-D341)
- 2026-10-29: AR0555: delivery line budget 1728 -> 1734, as the plan approved in AR-D328; the owner: "AR-D328 1" (AR-D342)
- 2026-10-29: Merge a ticket once its review passed, without asking the owner; pre-approved by policy (AR-D218)
