# AR0650 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the merge adds the passed review's notes of kind security, bug or risk. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. The README's one line per package has no room for stats

- Kind: docs
- Found by: 2026-11-06-worker-a83f424b (worker), 2026-11-06
- Where: `README.md:31`, `test/structure.test.ts:147`
- What: "Features" promises one line per package, but the README already holds 120 lines, the most `test/structure.test.ts` allows, so a `- **stats**, ...` line fails that test. This branch names stats only in the README's diagram (`self[Arthur itself<br/>manage, develop; stats partly built]`).
- Suggestion: shorten the README elsewhere by one line (for example join two lines of "Read more"), then add `- **stats**, partly built: the tokens, cost and time of every job run and coordinator turn ([stats](packages/stats/docs/stats.md)).`
- Status: fixed in 2668c044

## F2. arthur.mmd's status line does not count core entry 108

- Kind: docs
- Found by: 2026-11-06-worker-a83f424b (worker), 2026-11-06
- Where: `arthur.mmd:3`
- What: the line says the core has entries 1-22, 51, 80, 93 and 94 of 1-22, 51, 71, 80, 93 and 94; entry 108 (AR0649, usage in the job record) was merged on 2026-11-06 and is in neither list.
- Suggestion: add 108 to both lists of the core in that line; nothing else changes.
- Status: deferred (client summary)

## F3. `arthur plugin new` writes a package without the release version

- Kind: fix
- Found by: 2026-11-06-worker-a83f424b (worker), 2026-11-07
- Where: `packages/develop/src/plugin-template.ts`, `packages/develop/src/plugin-new.ts:59`
- What: main's `packages/core/test/plugin-range.test.ts` ("one release") wants every first-party package.json and its lockfile entry to hold the root's version (0.1.0). `arthur plugin new` writes neither `version` in the new `package.json` nor in its `package-lock.json` entry, so a package made by it fails `npm test` until edited by hand, though `docs/commands/plugin.md` says it passes with no hand edit. Seen when main was merged into this branch: stats' package failed that test; this branch added `"version": "0.1.0"` to both by hand.
- Suggestion: write the root `package.json`'s `version` into the new package.json and its lockfile entry, and test it in `plugin-new.test.ts`.
- Status: deferred (client summary)

## F4. F3 is still open: `arthur plugin new` writes no `version`, so the next new package will fail main's one-release test until that command is fixed

- Kind: fix
- Found by: 2026-11-07-review-a2c55e3a (review), 2026-11-07
- Where: `packages/stats/package.json:10`
- What: It is already filed in findings.md.
- Status: deferred (client summary)
