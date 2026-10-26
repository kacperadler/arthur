# AR0454 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. The reinstall after a failed check uses the cache the branch's install wrote

- Kind: security
- Found by: 2026-10-26-worker-b75a162b (worker), 2026-10-26
- Where: `packages/delivery/src/merge-command.ts` (`merge`, the `reinstall` call inside the merge's cache folder)
- What: a merge's steps and the reinstall of main's own dependencies after a failed check share one cache folder, as the ticket asks ("of that merge"). The branch's install, which ran first, can leave in that cache what main's reinstall then takes (npm checks a tarball's integrity against the lockfile, but other managers' caches, and npm's `_npx`, hold more than tarballs) [INFERENCE: not reproduced with a real package manager]. Before AR0454 the shared caches had the same gap.
- Suggestion: run the reinstall with a step runner of its own over a fresh cache folder, removed after it; the cost is a second sandbox probe and, on a host without a user manager or the sandbox, a second `uncapped:` or `no sandbox:` line, which merge.md would then name.
- Status: open

## F2. A merge killed during its steps leaves its cache folder behind

- Kind: fix
- Found by: 2026-10-26-worker-b75a162b (worker), 2026-10-26
- Where: `packages/delivery/src/merge-command.ts` (`rmSync(cache, ...)` in `finally`)
- What: the merge's cache folder, `<delivery folder>/cache-<random>`, is removed in a `finally`, which a SIGKILL of `arthur merge` (or a crash of the machine) never reaches; the folder then stays, with whatever the branch's install wrote into it. No later merge reads it (each makes its own with `mkdtemp`), so it costs disk only [INFERENCE: from the code, not run].
- Suggestion: at the start of each merge, delivery removes the `cache-*` folders of its own folder older than a day (a younger one may be another merge's, running); out: reusing one.
- Status: open
