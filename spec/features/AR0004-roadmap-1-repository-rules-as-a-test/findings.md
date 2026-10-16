# AR0004 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

`- Budget:` is optional: set it, in USD, only when the ticket this finding becomes is expected to cost more than the autopilot default, and leave the line out otherwise. `h merge` copies it into the ticket's JSON block as `budget`, which `h ticket status --autopilot` passes to `--budget`, capped at `H_AUTOPILOT_BUDGET_MAX`.

## F1. `arthur plugin new` meets the line-budget rule

- Kind: risk
- Found by: 2026-10-16-ar0004-repository-rules-e926d472 (worker), 2026-10-16
- Where: `test/structure.test.ts` (`BUDGETS`), `spec/roadmap.md` entry 66
- What: the structure test fails a package that has no entry in `BUDGETS` (`packages/<name>: has no line budget; add one to test/structure.test.ts`), so the budget of each plugin is decided in its own ticket. Entry 66's Done means says the structure test passes on a package `arthur plugin new` creates; as written it would not until someone adds the plugin's budget line.
- Suggestion: entry 66 either adds the line to `BUDGETS` itself or its Done means says the new plugin's ticket adds it; the structure test keeps refusing a package without a budget.
- Status: open

## F2. Dev dependencies beyond the toolchain are not checked

- Kind: improvement
- Found by: 2026-10-16-ar0004-repository-rules-e926d472 (worker), 2026-10-16
- Where: `test/structure.ts` (`checkManifest`)
- What: the styleguide says dev dependencies are the toolchain only (`typescript`, `@types/node`); roadmap entry 1 lists only runtime dependencies, so the structure test checks `dependencies`, `optionalDependencies` and `peerDependencies` and lets any `devDependencies` through.
- Suggestion: add an allow-list of dev dependencies to the structure test, with a fixture that adds another one and fails.
- Status: open
