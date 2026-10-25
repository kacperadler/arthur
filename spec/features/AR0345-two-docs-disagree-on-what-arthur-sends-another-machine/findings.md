# AR0345 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. The vision still says Arthur sends another machine no secret

- Kind: docs
- Found by: 2026-10-25-worker-e48e0ded (worker), 2026-10-25
- Where: `spec/vision.md:134`
- What: "A machine needs Node, git, OMP logged in with its own credential, and the same version of Arthur's core; Arthur sends it no secret." A `prepare`'s variables, a provider's key of the models plugin among them, go to the machine on the launch's stdin (`packages/core/docs/commands/spawn.md`, "On another machine"), as `docs/deploy.md:9` now says. The vision is the owner's product text, so this worker left it.
- Suggestion: "Arthur sends it no MCP secret, only a `prepare`'s variables (a provider's key of the models plugin) on the launch's stdin", if the owner agrees.
- Status: ticket AR0413

## F2. `docs/deploy.md:9` changed outside the ticket's three places

- Kind: docs
- Found by: 2026-10-25-review-ab9e2646 (reviewer, non-blocking note), 2026-10-25
- Where: `docs/deploy.md:9`
- What: It repeated the same "no secret" claim; the worker fixed it so the docs agree.
- Status: dropped (needed for the Goal; matches `spawn.md:62`)

## F3. The docs point to `arthur spawn --help` rather than `spawn.md`

- Kind: docs
- Found by: 2026-10-25-review-ab9e2646 (reviewer, non-blocking note), 2026-10-25
- Where: `coordinator.md:139`, `jobs.ts:176`
- What: The ticket said "point to `spawn.md`"; `arthur spawn --help` prints that file.
- Status: dropped (the docs' own convention)

## F4. One test in machine.test.ts skips without a systemd user manager

- Kind: test
- Found by: 2026-10-25-review-ab9e2646 (reviewer, non-blocking note), 2026-10-25
- Where: `packages/core/test/machine.test.ts:572`
- What: Explains the worker's 35 of 36.
- Status: dropped (by design; the range does not touch it)
