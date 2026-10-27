# AR0466 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. A symlink or a HEAD folder the branch itself commits is kept by the sweep

- Kind: security
- Found by: 2026-10-27-worker-cae1ba87 (worker), 2026-10-27
- Where: `packages/delivery/src/merge-checks.ts:29` (`const before = repositories(root)`, taken after `git merge`)
- What: the sweep keeps every repository that was there before the first step, and the merge commit is already checked out then. So a branch that commits a symlink (`src/link -> ../../.git/objects/xx`, or to a folder outside the checkout) or a folder holding `HEAD`, `objects/`, `refs/` and a `config` with `core.fsmonitor` gets it kept, as the owner's own. A job's sandbox writes the shared Git folders a commit writes (`docs/deploy.md`, "Threat model"), so whether a job can plant a Git folder in `.git/objects` for such a symlink to point at is [INFERENCE], not tried. Not reproduced.
- Suggestion: take `before` from main's checkout before `git merge` (the owner's state), or have `arthur merge` refuse a branch that adds a symlink leading out of the checkout or into `.git`, or a tracked file named `HEAD` next to an `objects/` folder. Out: the step sweep this ticket made.
- Status: ticket AR0490

## F2. An owner's unchanged symlink to a file a step can write lets a step plant a repository behind it

- Kind: security
- Found by: 2026-10-27-review-55a9e2ce (review), 2026-10-27
- Where: `packages/delivery/src/merge-checks.ts:30`
- What: an owner's symlink to a file in `.git/objects`, `refs` or `logs`, the temporary folder or the merge's cache stays as the owner's own; a step can replace its target with a planted repository, and `git status` through the link then runs its fsmonitor. Reproduced by the reviewer. Needs the owner to have such a link.
- Status: ticket AR0490 (the same root: what counts as the owner's state before the first step; added to its Description)

## F3. `escapes` joins the link's folder by text, not its real path

- Kind: security
- Found by: 2026-10-27-review-55a9e2ce (review), 2026-10-27
- Where: `packages/delivery/src/merge-checks.ts:79`
- What: only when the checkout's own path goes through a symlink could a target with `..` be judged inside when it is outside; `realpathSync(dirname(link))` closes it.
- Status: ticket AR0490 (one line, same file; added to its Description)

## F4. A committed test fixture holding a `HEAD` that a step writes into is removed whole

- Kind: ux
- Found by: 2026-10-27-review-55a9e2ce (review), 2026-10-27
- Where: `packages/delivery/src/merge-checks.ts`
- What: any folder with a `HEAD` now counts as a repository, broader than `HEAD` and `objects/`; safer for a linked worktree's Git folder.
- Status: dropped (safer by design; Git restores the fixture)
