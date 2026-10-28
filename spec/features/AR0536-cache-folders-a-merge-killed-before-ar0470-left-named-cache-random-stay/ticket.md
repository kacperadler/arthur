# AR0536 - Cache folders a merge killed before AR0470 left, named `cache-<random>`, stay

```json
{
  "id": "AR0536",
  "title": "Cache folders a merge killed before AR0470 left, named `cache-<random>`, stay",
  "date": "2026-10-28"
}
```

## Description

F2 of AR0470 (spec/features/AR0470-a-merge-killed-during-its-steps-leaves-its-cache-folder-behind/findings.md).

- Kind: chore
- Found by: 2026-10-27-worker-7ccfb33a (worker), 2026-10-28
- Where: `packages/delivery/src/merge-command.ts:65`
- What: AR0470 renamed a merge's cache folders `cache_<random>` and sweeps only those, since a project may be named `cache-<anything>` (`packages/projects/src/project-options.ts:14`) and its folder in delivery's holds `last-merge` (review 2026-10-28-review-1600b1c1). A `cache-<random>` folder that a merge killed between AR0454 and AR0470 left is therefore never removed; its name alone cannot tell it from such a project's folder.
- Suggestion: the owner removes them once by hand after checking none is a project's folder (`ls -d <delivery folder>/cache-*`, then `rm -rf` each whose name is no project's in the project list); no code. Out: a sweep of `cache-*`.

## Goal

No cache folder a killed merge left before AR0470 stays on the disk. Evidence: AR0470 sweeps only `cache_*`; on this host `.arthur/delivery/cache-UpOQLz` (11 MB, dated 2026-10-27) is left, and `arthur` is the only project, so it is no project's folder.

- Kind: chore

## Done means

- Every `cache-<random>` folder in delivery's folder whose name is no project's is removed once, by hand, after the owner's word; `ls -d` of the pattern then lists none.
- No code changes.

## Scope

In:
- Delivery's folder under `.arthur/` on each machine Arthur runs merges on (today only this host).

Out:
- A sweep of `cache-*` in code (a project may be named so).

## Decisions

- 2026-10-28: Source: F2 of AR0470
