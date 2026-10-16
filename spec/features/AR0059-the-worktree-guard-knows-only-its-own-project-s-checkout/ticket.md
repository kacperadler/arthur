# AR0059 - The worktree guard knows only its own project's checkout

```json
{
  "id": "AR0059",
  "title": "The worktree guard knows only its own project's checkout",
  "date": "2026-10-16"
}
```

## Description

the guard reads its places from the job's record: that project's main checkout (`root`), the home folder, and the folder holding the job's worktree (`<root>/../.arthur-worktrees`). Once entry 41 adds more projects, a job of one project may still write into another project's main checkout or its jobs' worktrees, since no record names them. Today the core has one project, so nothing is open yet.

## Goal

With several projects (entry 41), a job of one project can never write into another project's main checkout or its jobs' worktrees.

- Kind: risk

Evidence:
- `packages/core/src/worktree-guard.ts` (`jobPlace`)
- Found by: 2026-10-16-ar0023-worktree-guard-a197f8a5 (worker), 2026-10-16

## Done means

- The worktree guard guards every declared project's main checkout and worktree folder, read from a list the core writes for each job (in its record, or one file under the home folder the projects plugin keeps current), not only the job's own project.
- A test with two projects: a job of project A writing into B's checkout or B's job worktree is refused, naming B; its own worktree still passes.
- `npm test` and `npm run check` pass.

## Scope

In:
- `packages/core/src/worktree-guard.ts`, the job record, their tests.

## Decisions

- 2026-10-16: Source: F1 of AR0023
- 2026-10-16: Coordinator: built after entry 41 (projects), when a second project exists.
