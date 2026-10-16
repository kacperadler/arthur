# AR0034 - Roadmap: disk space and Docker cleanup with each worktree

```json
{
  "id": "AR0034",
  "title": "Roadmap: disk space and Docker cleanup with each worktree",
  "date": "2026-10-16"
}
```

## Description

Add to `spec/vision.md`, the diagrams, the example config and `spec/roadmap.md` a capability that keeps every machine from running out of disk: Docker resources a job created are removed with its worktree, and free disk space is a resource the coordinator checks before starting work.

## Goal

The owner (2026-10-16): jobs that build and run containers again and again fill the disk; when it is full no agent can work. On the harness server today: Docker build cache 31.7 GB (21 GB reclaimable), images 9.5 GB (4 GB reclaimable), 127 volumes with 91% reclaimable; disk 66% used, 41 GB free.

- Kind: feature

## Done means

- The vision says: a job's Docker resources (containers, networks, volumes, images it built, and the build cache past a cap) are labelled with the job id and removed when its worktree is removed (prune, merge, drop), on every machine; shared images are kept; free disk space per machine is a resource: under a floor no job starts (the refusal names the machine and the space), and a scheduled sweep reclaims unlabelled leftovers older than a limit and warns the owner on a channel.
- Its home (the `resources` plugin, the job runner's worktree removal, or a small `docker` plugin) is chosen and said why; the example config shows its options (disk floor, build-cache cap, leftover age, on/off per project).
- `spec/roadmap.md` gets the ticket(s), half a day to a day each, with edge cases: Docker not installed or not running, a container still running at prune, a volume another job uses, a remote machine's Docker, cleanup failing (the worktree is still removed and the failure reported), the disk floor hit mid-job.
- English only. No feature code.

## Scope

In:
- `spec/vision.md`, `docs/architecture/*.mmd`, `arthur.config.example.ts`, `spec/roadmap.md`.

Out:
- Implementing it (its own ticket).

## Decisions

- 2026-10-16: The owner asked that Arthur watches disk space and cleans Docker with each worktree, so agents never stop for a full disk.
