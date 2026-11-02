# AR0392 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the merge adds the passed review's notes of kind security, bug or risk. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. A `core.gitProxy` planted after the check still runs: `-c` cannot override it

- Kind: security
- Found by: 2026-11-02-worker-c822fb9b (worker), 2026-11-02
- Where: `packages/core/src/git-config.ts:45`, `packages/github/src/github-git.ts:59`
- What: Git takes the first `core.gitProxy` it reads (connect.c returns once one is set), so the repository's own value wins over a `-c core.gitProxy=...` after it. A job's program that writes `core.gitProxy=<program>` between the check and `github.push`, while origin's URL (`remote.origin.url`, an allowed key) is a `git://` one, which `GIT_PROTOCOL_FROM_USER=0` allows always, has the push run that program. Reproduced by hand: a repository with `core.gitProxy=<planted>` and `git -c core.gitProxy=<own> ls-remote git://example.invalid/x` runs `<planted>`.
- Suggestion: set `GIT_PROXY_COMMAND` in the env of each call to origin and of `gitOver` (Git reads no `core.gitProxy` once it is set): empty, or the owner's own `core.gitProxy` when it has no ` for ` part. Out: a per-host `gitProxy ... for <host>` of the owner's, which no single env value says.
- Status: deferred (client summary)

## F2. A `protocol.allow` or `protocol.<name>.allow` planted after the check lets a push reach a folder's hooks or a URL's helper

- Kind: security
- Found by: 2026-11-02-worker-c822fb9b (worker), 2026-11-02
- Where: `packages/core/src/git-config.ts:45`, `packages/github/src/github-git.ts:59`, `packages/core/src/job-machine.ts:145`
- What: this ticket pins `protocol.ext.allow=never` only. `github.push` and `gitOver` keep a URL's other transports out with `GIT_PROTOCOL_FROM_USER=0` (AR0393), which `protocol.allow=always`, `protocol.file.allow=always` or `protocol.<helper>.allow=always` override. Written into the repository's config between the check and the push, with a remote URL that is a folder or `<helper>::...`, the push runs that folder's hooks (its receive-pack) or `git-remote-<helper>` from PATH. [INFERENCE] from Git's transport.c policy order; no race was run.
- Suggestion: pin `protocol.allow` and `protocol.file.allow` with the owner's value, or Git's default (`protocol.allow` unset cannot be said with `-c`, so pin `protocol.<http|https|ssh|git>.allow` to `always` and `protocol.allow` to `user` together); a helper's own `protocol.<name>.allow`, named by the URL, stays behind the check as the drivers do.
- Status: deferred (client summary)

## F3. On another machine the push's receive-pack reads `core.alternateRefsCommand` again after `arthur remote-job repo` checked it

- Kind: security
- Found by: 2026-11-02-worker-c822fb9b (worker), 2026-11-02
- Where: `packages/core/src/job-machine.ts:162`, `packages/core/src/remote-job.ts:38`
- What: `arthur remote-job repo` checks `repos/<project>.git` there, then the push from here runs `git -c core.hooksPath=/dev/null receive-pack` there, which reads that config again. A job's program there that writes `core.alternateRefsCommand` (a key Git reads by a fixed name) and an `objects/info/alternates` in that gap has receive-pack run its program. [INFERENCE] from the two reads; no race was run.
- Suggestion: add `-c core.alternateRefsCommand=` (or the owner's own value there) to the `--receive-pack` command, after checking that an empty one makes receive-pack skip the alternates' refs rather than fail the push.
- Status: deferred (client summary)

## F4. the Threat model's list of keys that can still win the race leaves some out

- Kind: fix
- Found by: 2026-11-02-review-9b8e8072 (review), 2026-11-02
- Where: `docs/deploy.md:40`
- What: It names only filters, merge drivers and `core.gitProxy`. A `protocol.file.allow`/`protocol.<name>.allow` or `url.<base>.insteadOf` written in the gap can still send `github.push` to a folder's hooks. That gap is the worker's F2 in `findings.md`, but the doc doesn't mention it.
- Status: deferred (client summary)
