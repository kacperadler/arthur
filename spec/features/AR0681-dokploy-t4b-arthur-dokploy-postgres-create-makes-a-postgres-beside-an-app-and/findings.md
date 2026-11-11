# AR0681 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the merge adds the passed review's notes of kind security, bug or risk. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. postgres create can make the database and then meet env set's refusal of a name inside another value

- Kind: fix
- Found by: 2026-11-11-worker-a59419ba (worker), 2026-11-11
- Where: `packages/dokploy/src/dokploy-postgres.ts:46`, `packages/dokploy/src/dokploy-env.ts:39`
- What: `postgres create` refuses, before it creates anything, an app whose env sets `<NAME>` to another value. An env where `<NAME>=` appears only inside another variable's value over several lines (`CERT="...\nDATABASE_URL=x\n..."`) does not set it, so the database is created; then `setVariable` refuses the line (`the env holds DATABASE_URL over several lines or inside another value ...; nothing was sent`). The database stays, unconnected; a second run finds it and meets the same refusal. Nothing of the owner's is lost. Reproduce: an app with env `CERT="a\nDATABASE_URL=b\nc"`, then `arthur dokploy postgres create <app> db`. [INFERENCE] from the code at lines 46 and 39; no test runs this case.
- Suggestion: split `setVariable` into the pure line building (which throws) and the write, and run the line building with a placeholder URL before `postgres.create`; or leave it, since the refusal names the next step (set it in Dokploy's panel). Out: any change to `env set`'s own messages.
- Status: open
