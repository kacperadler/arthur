# AR0358 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. Other installs' files are not on the list

- Kind: security
- Found by: 2026-10-25-review-f09761ba (reviewer, non-blocking note), 2026-10-26
- Where: `packages/delivery/src/delivery-options.ts`, `packages/projects/src/install.ts:13-14`
- What: composer, uv, yarnrc, pnpmfile, bunfig.
- Status: ticket AR0432

## F2. A pattern does not match inside a dot folder

- Kind: security
- Found by: 2026-10-25-review-f09761ba (reviewer, non-blocking note), 2026-10-26
- Where: `packages/delivery/src/delivery-options.ts`
- What: `.config/.npmrc` is not matched.
- Status: dropped (the merge and install read the root's files only; the doc says the rule)

## F3. A live config with its own `alwaysReview` needs the entries by hand

- Kind: docs
- Found by: 2026-10-25-worker-58e611f1, 2026-10-25-review-f09761ba, 2026-10-26
- Where: `arthur.config.ts`
- What: a list there replaces the default.
- Status: dropped (the owner's live config sets none; checked by the coordinator)
