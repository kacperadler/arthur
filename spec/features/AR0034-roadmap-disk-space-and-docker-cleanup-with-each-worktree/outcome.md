# AR0034 - Outcome

- Merged: 2026-10-16, `af0e47f`
- Branch: h/2026-10-16-ar0034-disk-and-docker-c-1cb169d7
- Reviews: review-1.md PASS
- Cost: worker $2.43, reviews $0.50; review rounds 1

## What went in

- `spec/vision.md`: section "Disk space and Docker": a disk floor in `resources` (`keepFree.disk`), a `docker` plugin that labels each job's containers, volumes and built images and removes them with its worktree, a daily labelled sweep; `docker: false` per project.
- `spec/roadmap.md`: entries 69–72 (disk floor, the core's one worktree-removal point and hook, the docker plugin, the sweep); Later moved to 73–76.
- `arthur.config.example.ts`, `docs/architecture/*.mmd`: the options and nodes.

## Checks on main

- `npm run check`: passed.
- `npm test`: 105/105 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Tickets from findings: AR0037 (F1).
