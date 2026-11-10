# AR0680 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the merge adds the passed review's notes of kind security, bug or risk. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. The vision's dokploy row does not name the Git source

- Kind: docs
- Found by: 2026-11-10-worker-622e3180 (worker), 2026-11-10
- Where: `spec/vision.md:77`
- What: the dokploy row says `arthur dokploy` "reads projects, applications and deployments, and uploads a file or folder or starts a deploy only on the owner's word". Since AR0654 it also creates and sets up apps, and since AR0680 it connects an app to its GitHub repository so a push deploys it. The vision is the owner's, so the worker left it as it is; the AR0655 plan puts this row in T4c.
- Suggestion: the owner adds to the row that `arthur dokploy` creates and sets up an app and connects it to its GitHub repository (deploy on push), on his word; nothing else in the row changes.
- Status: deferred (client summary)
