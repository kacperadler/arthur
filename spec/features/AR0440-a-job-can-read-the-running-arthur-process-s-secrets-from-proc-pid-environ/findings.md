# AR0440 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. Branch code run outside the sandbox can read Arthur's environment

- Kind: security
- Found by: 2026-10-26-plan-32afc87a (worker), 2026-10-26; recorded by 2026-10-26-worker-8dba5348 (worker)
- Where: `packages/core/src/job-install.ts:12`, `packages/delivery/src/merge-checks.ts` (`stepRunner`)
- What: the wrapper's install step (`install`, run before `sandboxed` in `wrapper.ts`) and the merge checks (install, `npm run check`, `npm test` of the merged main) run a branch's code, its lifecycle scripts and tests included, outside any Landlock domain, so that code can read `/proc/<pid>/environ` of `arthur run` and the coordinator. Inferred from the plan's bare run (an unsandboxed child read its parent's and a sibling's environment), not tested on these two paths. The owner's question is AR-D65, unanswered when this was written.
- Suggestion: run both steps through `sandboxed` with the package managers' caches (`~/.npm`, `~/.bun`) among the writable paths; the env file on disk stays out (AR0443).
- Status: dropped (the same gap as AR0449, approved under AR-D65; AR0451 dropped as its duplicate)
