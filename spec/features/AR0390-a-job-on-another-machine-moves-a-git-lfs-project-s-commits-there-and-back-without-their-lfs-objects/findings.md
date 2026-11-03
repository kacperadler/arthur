# AR0390 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the merge adds the passed review's notes of kind security, bug or risk. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. The machines plugin may place a Git LFS project's spawn on another machine, which the core then refuses

- Kind: ux
- Found by: 2026-11-03-worker-bb81d62e (worker), 2026-11-03
- Where: `packages/machines/src/machine-place.ts:80`
- What: [INFERENCE] from the lines of `jobs.place` and `machines.md`, "Placing a job": a spawn that names no machine goes to the online machine with the most room, `local` only on a tie. For a Git LFS project the core's `reach` (`packages/core/src/job-machine.ts`) now refuses that spawn (`machine <name>: a .gitattributes of <commit> names filter=lfs: ...`) instead of the placement keeping it on `local`, so such a project's spawns fail whenever another machine has more room.
- Suggestion: let placement know a spawn's project is a Git LFS one (the core asks `namesLfs` before `machines.pick` and hands it in the `jobs.place` question, or places it on `local` itself when no machine is named) and keep it on `local`, refusing only a spawn that names or requires another machine. Out: carrying LFS objects to another machine.
- Status: open

## F2. A job on another machine that makes its branch a Git LFS one leaves the LFS objects there

- Kind: fix
- Found by: 2026-11-03-worker-bb81d62e (worker), 2026-11-03
- Where: `packages/core/src/machine-sync.ts:88`
- What: [INFERENCE] from Git LFS's documented behavior; git-lfs is not installed here. The refusal of AR0390 reads the base and the spawn's fetch only. A job there whose base names no `filter=lfs` but whose branch adds a `.gitattributes` with it (`git lfs track`, git-lfs installed there) keeps its large files in the machine's `repos/<project>.git/lfs`; the sweep's `git fetch-pack` brings pointers only, and `github.push` of that branch then refuses (`its LFS objects were not pushed: ...`).
- Suggestion: at the sweep's fetch of an ended job's branch, when the branch names `filter=lfs`, say so in the job's log and a `notice` (its large files stay on the machine), or have the worktree guard there refuse `git lfs` in a job. Out: an LFS transfer between the machines.
- Status: open
