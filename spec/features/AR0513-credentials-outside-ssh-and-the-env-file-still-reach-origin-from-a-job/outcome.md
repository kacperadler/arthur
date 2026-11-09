# AR0513 - Outcome

- Merged: 2026-11-09, `a98cd706`
- Branch: arthur/2026-11-09-worker-a8a24a62
- Reviews: review-1.md PASS
- Cost: worker $3.87, reviews $1.34; review rounds 1

## What went in

- packages/core/src/job-sandbox.ts: `unread()` lists each `~/.ssh`, Git's and `gh`'s credential stores in those homes, and `$XDG_CONFIG_HOME/git/credentials`, `$XDG_CONFIG_HOME/gh` and `$GH_CONFIG_DIR`; `hidden()` and `stepSandbox()` hide all of them.
- packages/core/src/plugin.ts: the `Host.sandbox` comment says a step reads neither Git's nor `gh`'s credentials.
- packages/core/test/sandbox.test.ts: tests that a job's install, its agent and a merge step cannot read each store; the hidden list for each `HOME`, `XDG_CONFIG_HOME` and `GH_CONFIG_DIR` case; a `.arthur-worktrees` folder holding the job's checkout or record is not hidden; the merge step's list starts with the env file and `~/.ssh`.
- packages/core/docs/commands/spawn.md: "The sandbox" names the hidden credential stores, the new log line part, `~/.config/git` among the folders above a hidden path, and the stores in Limits.
- packages/delivery/docs/commands/merge.md: checks on main read neither Git's nor `gh`'s stored credentials.
- docs/deploy.md: the threat model names the hidden stores, says a key an `IdentityFile` names outside `~/.ssh` or a token in another file stays readable, and advises keeping none for Arthur's user.
- docs/plugin-api.md: `sandbox(folder, cache, note)` reads neither Git's nor `gh`'s stored credentials.
- test/structure.test.ts: core line budget raised from 7438 to 7444.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1597/1668 passed.

## Left open

- Deferred (client summary): F1. `~/.netrc` is not hidden
- Deferred (client summary): F2. other stores stay readable, and `deploy.md:48` only covers them as "a token in a file of your own": Git Credential Manager's plaintext store (`~/.gcm/store`), `hub`'s `~/.config/hub`, a token in a remote URL in a main checkout's `.git/config`, or an inline helper in `~/.gitconfig`
