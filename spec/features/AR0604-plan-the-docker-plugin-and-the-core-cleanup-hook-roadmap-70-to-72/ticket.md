# AR0604 - Plan: the docker plugin and the core cleanup hook, roadmap 70 to 72

```json
{
  "id": "AR0604",
  "title": "Plan: the docker plugin and the core cleanup hook, roadmap 70 to 72",
  "date": "2026-11-01",
  "machine": "local"
}
```

## Description

Jobs that build and run containers fill the disk, and today nothing removes what a job created in Docker. This ticket plans the three roadmap entries that fix it, so that each job's Docker resources go away with its worktree and a daily sweep reclaims what is left over.

## Goal

Plan roadmap entries 70 (labels on what a job creates), 71 (cleanup with each worktree, and the core's `host.jobs.cleanup(fn)` hook) and 72 (the leftover sweep and `arthur docker`), as `spec/vision.md`, "Disk space and Docker", describes them. The plan splits them into worker tickets.

Evidence that this is not built:
- There is no `packages/docker`.
- `grep -rn 'jobs.cleanup' packages/core/src` finds nothing.
- `README.md` line 55 lists "docker and the core's cleanup hooks" as planned.
- AR0555's Description says the docker plugin and `host.jobs.cleanup` already exist. That claim is wrong: AR0555 built origin branch deletion through `jobs.keep` instead.

What already holds, and the plan reuses rather than rebuilds:
- `arthur prune`, and the prune that a merge or a drop runs (`packages/delivery/src/ticket-prune.ts`).
- The `jobs.keep` hook that github uses.
- The disk floor from `resources` (entry 69).

- Kind: feat
- Plan: yes

## Done means

- A plan the owner approves. It covers:
  - the files of each worker ticket;
  - the core hook's contract;
  - whether `jobs.keep` already serves as the cleanup hook, or the reason a separate one is smaller;
  - a fake `docker` in the shape of Docker's CLI output;
  - each package's line budget;
  - the questions for the owner.
- The plan states which of the owner's projects run Docker on which machines today. If none does, it says what that means for the order.

## Scope

In:
- The plan only, in this ticket's folder.

Out:
- Any code. The worker tickets the plan names do that.

## Decisions
- 2026-11-01: AR0604 approved; its plan is written on 2026-11-04 at 10:30; the owner: "AR-D430 2 and plan it at nov 4 at 10:30" (AR-D430)
- 2026-11-04: Keep the four Docker worker tickets of the AR0604 plan unbuilt until a project needs Docker in jobs; set resources keepFree.disk 20G now; the owner: "AR-D487 - 1 - i have to add more memory to this mashine also?" (AR-D487)

