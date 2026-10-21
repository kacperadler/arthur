# AR0242 - The checks on main run on the service's Node, not the project's .nvmrc

```json
{
  "id": "AR0242",
  "title": "The checks on main run on the service's Node, not the project's .nvmrc",
  "date": "2026-10-21",
  "after": [
    "AR0241"
  ]
}
```

## Description

a job's worktree gets the nvm plugin's Node first on PATH (its `prepare`), but the merge's install and `npm run check`/`npm test` on main run with whatever PATH the coordinator's shell has. A project pinned to another Node major in `.nvmrc` can pass in its worker and fail, or pass when it should not, on main.

## Goal

What we are after, what it moves in `spec/vision.md`, and the evidence (file:line, a command and its output). A mechanical, fully specified change (a rename, a moved section, a list of exact edits) adds `- Model: haiku` under Kind; anything with behaviour to judge has no Model line.

- Kind: risk

Evidence:
- `packages/delivery/src/merge-checks.ts:56` (`step`, which runs with the `arthur merge` process's PATH)
- Found by: 2026-10-20-roadmap-54-arthur-merge-76ffc10e (worker), 2026-10-21

## Done means

- The fix, with a test that proves it: a provided name from the nvm plugin answering the PATH for a project's checkout (the same `nvm which` it runs for a worktree), asked by the merge before its steps; without the plugin, the PATH as it is.
- `npm test` and `npm run check` pass.

## Scope

In:
- a provided name from the nvm plugin answering the PATH for a project's checkout (the same `nvm which` it runs for a worktree), asked by the merge before its steps; without the plugin, the PATH as it is.

## Decisions

- 2026-10-21: Source: F2 of AR0239
- 2026-10-21: Approved by the owner (Telegram, morning report).
