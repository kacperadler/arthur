# AR0052 - A ticket moved to merged or dropped during a spawn still gets its worker

```json
{
  "id": "AR0052",
  "title": "A ticket moved to merged or dropped during a spawn still gets its worker",
  "date": "2026-10-16"
}
```

## Description

the core's `beforeSpawn` reads the ticket's status, then the worktree, the node_modules copy and every `prepare` run, and only `job-started` moves the ticket to in-progress. An `arthur ticket` move to `planning`, `merged` or `dropped` in that window passes the check, and the move at `job-started` fails with the old stderr line `plugin core: handler of job-started (event N) failed: ...` while the job exists. [INFERENCE] from the order of the lines in `packages/core/src/jobs.ts` `spawn`; not reproduced, the window needs a second writer during a spawn.

## Goal

What we are after, what it moves in `spec/vision.md`, and the evidence (file:line, a command and its output). A mechanical, fully specified change (a rename, a moved section, a list of exact edits) adds `- Model: haiku` under Kind; anything with behaviour to judge has no Model line.

- Kind: security

Evidence:
- `packages/core/src/host.ts` (the core `beforeSpawn` check and the `job-started` handler)
- Found by: 2026-10-16-ar0048-refuse-spawn-on-u-b2cbf1cc (worker), 2026-10-16

## Done means

- The fix, with a test that proves it: move the ticket to in-progress inside the spawn, under the board's lock, before the worktree exists, and move it back (or leave it, decided in the ticket) when a later step removes the job; this touches `jobs.ts`, which AR0014 changes, so it was kept out of AR0048.
- `npm test` and `npm run check` pass.

## Scope

In:
- move the ticket to in-progress inside the spawn, under the board's lock, before the worktree exists, and move it back (or leave it, decided in the ticket) when a later step removes the job; this touches `jobs.ts`, which AR0014 changes, so it was kept out of AR0048.

## Decisions

- 2026-10-16: Source: F1 of AR0048
