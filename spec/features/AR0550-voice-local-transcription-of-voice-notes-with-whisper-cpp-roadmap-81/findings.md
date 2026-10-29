# AR0550 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. `arthur plugin new` is unknown in Arthur's own checkout

- Kind: fix
- Found by: 2026-10-28-worker-1db9989f (worker), 2026-10-28
- Where: `packages/develop/src/plugin-new.ts:129` (the worker's "A new plugin" line); the checkout's `arthur.config.ts`
- What: the line tells a worker to run `cd <checkout> && node_modules/.bin/arthur plugin new <name> --budget <lines> --root <worktree>`. Run as written from `/home/kacper/arthur`, it printed `arthur: unknown command plugin`: the checkout's `arthur.config.ts` does not list `develop()`, so the CLI has no `plugin` command. This worker made the package with the same code by calling `pluginCommand` from `packages/develop/src/plugin-new.ts` with a minimal host.
- Suggestion: either enable `develop()` in the checkout's config, or offer the line only when the develop plugin is loaded there (it is today offered whenever the project has `packages/core`). Out: the package template itself, which worked.
- Status: deferred (client summary)

## F2. Notes of the three reviews

- Kind: docs
- Found by: 2026-10-28-review-b27c06ad, 2026-10-28-review-41e8a160, 2026-10-28-review-2b0f9f3d (reviewers), 2026-10-28
- Where: `packages/voice/`
- What: a run with no time limit would hang the tests rather than fail them; each tool has its own time limit, so one file may take twice `timeoutSeconds`; the queue is per process, so `arthur transcribe` from a shell does not wait for `arthur run`'s queue; a part's own `seconds` is trusted for `maxSeconds`. Each is as roadmap 81 and the plugin's docs say.
- Status: dropped (documented behaviour, as roadmap 81 specifies)
