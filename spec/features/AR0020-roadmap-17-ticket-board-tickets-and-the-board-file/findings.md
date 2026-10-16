# AR0020 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

`- Budget:` is optional: set it, in USD, only when the ticket this finding becomes is expected to cost more than the autopilot default, and leave the line out otherwise. `h merge` copies it into the ticket's JSON block as `budget`, which `h ticket status --autopilot` passes to `--budget`, capped at `H_AUTOPILOT_BUDGET_MAX`.

## F1. A project's relative path is taken from the working folder, not the config's

- Kind: risk
- Found by: 2026-10-16-ar0020-ticket-board-ee737520 (worker), 2026-10-16
- Where: `packages/core/src/board.ts` (`join(where.path, FILE)`)
- What: the board reads `spec/build.json` under each project's `path` as the `projects` provider returns it. The example config writes `path: "."`; passed through unresolved, `arthur ticket` run from a subfolder, or `arthur run` started by systemd in another folder, would read and write a board that is not the project's.
- Suggestion: the board refuses a relative `path` in its project-list check, so entry 41 must resolve `path` against the config's folder before it provides the list (as `loadConfig` does for `home`). Out: anything else of entry 41.
- Status: fixed in 3a0ba8f (the refusal; resolving the path is entry 41's)

## F2. A crash mid-write leaves the board's lock or temporary file in the project's `spec/`

- Kind: risk
- Found by: 2026-10-16-ar0020-ticket-board-ee737520 (worker), 2026-10-16
- Where: `packages/core/src/board.ts` (`withLock(`${file}.lock`)`), `packages/core/src/board-file.ts` (`writeBoard`)
- What: the lock `spec/build.json.lock` (and `spec/build.json.lock.<pid>` while it is taken) and the temporary `spec/build.json.<pid>.tmp` live next to the board, in the project's repository. They exist only for the moment of a write, and a dead holder's lock is taken over, but a process killed in that moment leaves an untracked file that `git add spec` would commit.
- Suggestion: either ignore `spec/build.json.*` in the skeleton `arthur init` writes (entry 42), or keep the lock under the home folder, e.g. `.arthur/board/<project>.lock`. Out: changing the lock itself.
- Status: open
