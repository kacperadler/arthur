# AR0654 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the merge adds the passed review's notes of kind security, bug or risk. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. An env value set with `arthur dokploy env <app> set` stays in the coordinator's session

- Kind: security
- Found by: 2026-11-06-worker-a8614f6b (worker), 2026-11-06
- Where: `packages/dokploy/src/dokploy-env.ts:12`
- What: the ticket gives the value as a word of the command line (`set <NAME> <value>`). The command never prints it, but the coordinator runs the command through its shell tool, so the value is in that session's transcript, which the model provider keeps, and in the shell's history. The owner's message that gave the value is in the transcript too, so this adds no new place the value reaches when the owner typed it; it does when the value comes from a file the coordinator read.
- Suggestion: take the value from stdin or from a file path (`set <NAME> --from <file>`), the file then removed, so a value never has to be a word of a command; out: values typed by the owner into a chat, which a channel keeps anyway.
- Status: deferred (client summary)

## F2. The vision's dokploy row does not name creating and setting up an app

- Kind: docs
- Found by: 2026-11-06-worker-a8614f6b (worker), 2026-11-06
- Where: `spec/vision.md:77`
- What: the row says `arthur dokploy` reads, uploads and deploys on the owner's word; since AR0654 it also creates an app and sets its build type, domain, volume and env. The vision is the owner's, so the branch leaves it as it is.
- Suggestion: the owner adds "creates an app and sets its build type, domain, volume and env" to the row; nothing else changes.
- Status: deferred (client summary)

## F3. Node's `parseEnv` is not dotenv

- Kind: fix
- Found by: 2026-11-06-review-9c9d406c (review), 2026-11-07
- Where: `packages/dokploy/src/dokploy-env.ts:10`
- What: The guard against changing other lines and the "reads back as given" check use Node's parser, while Dokploy reads with `dotenv`. Where the two parse a line differently (backticks, escapes), the saved line could read back differently on the server.
- Status: deferred (client summary)
