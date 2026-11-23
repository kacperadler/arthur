# AR0717 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the merge adds the passed review's notes of kind security, bug or risk. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. Two architecture diagrams and the roadmap's order still draw project agents as a later item not yet built

- Kind: docs
- Found by: 2026-11-23-worker-10684f84 (worker), 2026-11-23
- Where: `docs/architecture/versions.mmd:16`, `docs/architecture/versions.mmd:30`, `docs/architecture/core-and-plugins.mmd:105`, `spec/roadmap.md:13`, `spec/roadmap.md:1079`
- What: after AR0717 the vision says project agents (roadmap 85 to 88) are built, as `README.md:32` and `arthur.mmd:157` (`class agents built;`) do. Three files the ticket's Scope does not name still show them only as a later item: `versions.mmd` has `agents[1 project agents ...]` first under `Later, in this order`, after `Switch the other projects`, in the grey dashed `later` class; `core-and-plugins.mmd` keeps `agents` in its `later` class; `spec/roadmap.md` keeps entries 85 to 88 under `## Later`, and its Order paragraph says "project agents (85 to 88) first, once the other projects have moved to Arthur". Both diagrams chart versions (their first line: "Green = first version, grey dashed = later"), not what is built, and as a chart of versions they hold: the tag `v0.1.0` is of 2026-11-12 (`git log -1 --format=%cs v0.1.0`) and AR0705 merged on 2026-11-14 (`git log --format=%cs --grep='AR0705 merged'`). Reproduce: `grep -n agents docs/architecture/versions.mmd docs/architecture/core-and-plugins.mmd`, `grep -n '^## Later' spec/roadmap.md`.
- Suggestion: the owner says which reading the two diagrams and the roadmap take. Either project agents count as the first version (the `agents` node moves into `versions.mmd`'s `V1` and both `first` class lists, the later chain is numbered again from signal, entries 85 to 88 leave `## Later`), or they stay the first later item, marked built (a class for it in both diagrams, the Order paragraph in the past tense). No code changes; the vision stays as AR0717 left it.
- Status: open
