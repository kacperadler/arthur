# AR0399 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the merge adds the passed review's notes of kind security, bug or risk. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. A committed .lfsconfig sends github.push's LFS upload to another endpoint, past the dry run

- Kind: security
- Found by: 2026-11-05-worker-c3195e81 (worker), 2026-11-05
- Where: `packages/github/src/github-git.ts:89`
- What: git-lfs takes its endpoint from `lfs.url`, `lfs.pushurl` or `remote.origin.lfsurl` before origin's URL, and reads them from the `.lfsconfig` of the checkout's working tree, a file a job's branch can commit and a merge brings into main's checkout; `@arthur/core/git-config` checks only `.git/config`. With git-lfs 3.5.1, origin a folder and a committed `.lfsconfig` holding `lfs.url = file:///<other folder>` (likewise `lfs.pushurl`, `remote.origin.lfsurl`), `git lfs push origin refs/heads/main` put the object into the other folder, none into origin; `remote.origin.lfspushurl` it ignored as an unsafe `.lfsconfig` key. The dry run of AR0399 checks origin's push URL, so it passes, and the upload goes to the `.lfsconfig` endpoint under no `protocol.<name>.allow` (a folder written to; `<name>://` runs `ssh` to host `<name>`, as the AR0399 probe saw for origin's URL). Pinning the four keys empty with `-c` stopped it, but also left git-lfs with no endpoint (`batch request: missing protocol: ""`).
- Suggestion: refuse the LFS step while the `.lfsconfig` git-lfs reads (the working tree's, else the index's or HEAD's) sets one of `lfs.url`, `lfs.pushurl`, `remote.<name>.lfsurl`, naming the file and the key as a config refusal does; or pin each of them with `-c` to the endpoint git-lfs derives from the URL the dry run checked. Which one, given a project may keep its LFS objects on a server of its own, is the owner's call. Out: origin's URL, which AR0399 covers.
- Status: deferred (client summary)

## F2. there is a gap between the dry run and the upload

- Kind: fix
- Found by: 2026-11-05-review-16f02ec7 (review), 2026-11-05
- Where: `packages/github/src/github-git.ts:84-89`
- What: Git checks origin's URL in the dry run, then git-lfs reads the config again. A process that rewrites `remote.origin.url` or `pushurl` in between gets past the check. The gap is short, and the earlier `originCheck` read has the same limit.
- Status: deferred (client summary)
