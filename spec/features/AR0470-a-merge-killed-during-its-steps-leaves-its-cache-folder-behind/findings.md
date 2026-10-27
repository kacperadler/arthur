# AR0470 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. A read-only folder a step leaves in the merge's cache turns a merge that went in into an error

- Kind: fix
- Found by: 2026-10-27-worker-7ccfb33a (worker), 2026-10-27
- Where: `packages/delivery/src/merge-command.ts:168` (`rmSync(cache, { recursive: true, force: true })` in `finally`), and `reinstall` in `packages/delivery/src/merge-checks.ts:73`
- What: `rmSync` with `recursive` and `force` throws `EACCES` on a folder holding a subfolder without write permission (seen: `node -e` making `probe-cache/sub` with a file, `chmod 0500 sub`, then `rmSync("probe-cache", { recursive: true, force: true })` printed `threw EACCES`). A step's code can leave one in the merge's cache folder (a package manager's read-only store, or the branch's script on purpose). The throw in the `finally` replaces `merge`'s return, so `arthur merge` exits with `EACCES` after main was merged, the ticket settled and the changelog written, and `github.push` is never asked [INFERENCE: from the code, not run]. The folder then stays; AR0470's sweep at a later merge's start (`find ... -exec rm -rf`) fails on it too, silently, at every merge.
- Suggestion: before removing a cache folder, give its owner write permission on every folder in it (`chmod -R u+w`, as Go's `go clean -modcache` needs), in the `finally`, in `reinstall`'s and in the sweep; or catch the removal's error and print one line naming the folder left. Out: reusing a cache folder.
- Status: open
