# arthur update

Usage: `arthur update [<tag or commit>]`

Moves Arthur's own checkout to a release and installs it: the Git checkout that holds the core (`packages/core`), found as the session plugin's restart guard finds it, whatever folder the command runs in. It needs no config, and is refused inside a job (`arthur help --help`).

1. `git fetch --tags origin` there.
2. The target: the tag or commit given, else the newest release tag, the first of `git tag --list 'v*' --sort=-v:refname`.
3. When the checkout is at that commit already: `up to date: <version>`, and nothing else is done.
4. Otherwise `git checkout` of that commit, detached, then `npm ci`, and `updated <old> to <new>`, each version as `arthur version` prints it (`<release> <hash>`).

Then the line of who restarts `arthur run` on the new code, which it loaded at its start: with the session plugin and its restart guard on, `arthur run restarts on it once no job and no merge runs (the session plugin's restart guard)`, as `packages/session/docs/session.md`, "The restart guard", says; without them, or when `arthur.config.ts` does not load, `restart arthur run on it once no job runs: systemctl --user restart arthur`.

A checkout on a branch, such as a development checkout of `main`, is updated with `git pull` and `npm ci` (`docs/deploy.md`, "Updating"); `arthur update <tag or commit>` still moves it, detached, to the commit given. `arthur machines update` runs `arthur update <commit>` on each machine of the `machines` plugin, the commit this checkout is at (`arthur machines --help`).

Refused, exit code 1, nothing changed:

- The core outside a Git checkout: `<core folder> is not in a Git checkout (<git's line>); install Arthur from a clone, as docs/setup.md, step 4, says`.
- Changed tracked files, each named: `<checkout> has changed tracked files: <path>, <path>; commit, stash or undo them first`.
- With no argument, a checkout on a branch: `<branch> is a development checkout; update it with git pull`.
- A fetch that fails: `git fetch in <checkout>: <git's line>`.
- No release tag: `<checkout> has no release tag v* after git fetch --tags origin`; a target that is no tag or commit there: `<target> is no tag or commit of <checkout> after git fetch --tags origin`.
- A `git checkout` that fails (an untracked file it would overwrite): `git checkout in <checkout>: <git's line>`.

When `npm ci` fails at the target, its errors printed, the checkout goes back to where it was, the branch it was on included, and runs `npm ci` there again: `npm ci failed at <target> (exit code <n>); back at <old>, npm ci ran again there`, or, when that fails too, `...; back at <old>, npm ci failed there too (exit code <n>): run npm ci in <checkout> by hand`. Exit code 1.

Wrong usage, more than one argument or one that starts with `-`: `usage: arthur update [<tag or commit>]`, exit code 2.
