# AR0588 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the merge adds the passed review's notes of kind security, bug or risk. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. `--instance` cannot name the unnamed instance

- Kind: ux
- Found by: 2026-10-31-worker-c2342d8c (worker), 2026-10-31
- Where: `packages/dokploy/src/dokploy-command.ts:29`
- What: with several instances, `arthur dokploy app <id>` or `status <id>` on the unnamed instance has no way to say so: `--instance` matches only a named instance (`--instance (unnamed)` is refused as no instance of dokploy), so the call goes through only with `--project` of a project whose `dokploy.project(...)` names no instance. `apps` still reads it. The plan names no word for it; the test "which instance: ..." in `packages/dokploy/test/dokploy.test.ts` pins the refusal.
- Suggestion: accept one reserved word for the unnamed instance, such as `--instance default`, refused as an instance `name` in `dokploy-options.ts` so it cannot clash; or leave it, since the owner can name every instance. A product choice, so it is not made here.
- Status: open
