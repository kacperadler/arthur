# AR0307 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. versions.mmd still shows the harness in use today

- Kind: docs
- Found by: 2026-10-25-worker-5da05172 (worker), 2026-10-25
- Where: `docs/architecture/versions.mmd:1`
- What: the diagram's comment and its first node say "The harness in use today, takes only fixes"; after the switch Arthur runs its own repository, so the diagram's starting point is out of date.
- Suggestion: redraw the start as the switch done (Arthur on its own repository, other projects to follow); leave the first-version and later groups as they are.
- Status: open

## F2. arthur.config.example.ts says nothing in it runs yet

- Kind: docs
- Found by: 2026-10-25-worker-5da05172 (worker), 2026-10-25
- Where: `arthur.config.example.ts:1`
- What: the header says "Nothing here runs yet, and the `@arthur/*` packages do not exist"; all but discord, docker, voice, whatsapp, signal, slack and server exist under `packages/` today, and copying the file fails only on the first missing one (`Cannot find package '@arthur/discord'`).
- Suggestion: say in the header which plugins exist today and which are planned (the `first`/`later` marks already sit on each import); keep the "Illustrative" warning for the planned ones.
- Status: open
