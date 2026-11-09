# AR0513 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the merge adds the passed review's notes of kind security, bug or risk. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. `~/.netrc` is not hidden

- Kind: security
- Found by: 2026-11-09-review-32655a3c (review), 2026-11-09
- Where: `packages/core/src/job-sandbox.ts:125`
- What: [INFERENCE] Git's HTTPS transport (libcurl, netrc optional) reads it, and so does `curl`, so a token there still lets a job push. The `deploy.md` advice to keep no credential elsewhere covers it, but the line could name it.
- Status: deferred (client summary)

## F2. other stores stay readable, and `deploy.md:48` only covers them as "a token in a file of your own": Git Credential Manager's plaintext store (`~/.gcm/store`), `hub`'s `~/.config/hub`, a token in a remote URL in a main checkout's `.git/config`, or an inline helper in `~/.gitconfig`

- Kind: fix
- Found by: 2026-11-09-review-32655a3c (review), 2026-11-09
- Where: `packages/core/src/job-sandbox.ts:125`
- What: other stores stay readable, and `deploy.md:48` only covers them as "a token in a file of your own": Git Credential Manager's plaintext store (`~/.gcm/store`), `hub`'s `~/.config/hub`, a token in a remote URL in a main checkout's `.git/config`, or an inline helper in `~/.gitconfig`.
- Status: deferred (client summary)
