# arthur github branch

Usage: `arthur github branch list`; `arthur github branch delete <branch> [--unmerged]`; `arthur github branch sweep [--dry-run]`; each with `[--project <name>]`. The shared rules (the project, the refusals inside a job) are `arthur github --help`.

The branches of the project's repository on origin, reached with git's own credentials, as `github.push` pushes them (`packages/github/docs/github.md`, "Pushes"): the token is never used, so it needs no permission for them.

## `branch list`

Every branch on origin, read with `git ls-remote --symref origin HEAD 'refs/heads/*'`, one line each in origin's order: `<branch> <commit> <where>`, `<where>` being `merged into <main>` (the checkout's main holds the tip), `not in <main>`, or `not here` (the checkout does not have the commit), then `, job <id> (<state>)` when a job's record names that branch, the newest one. With none: `no branches on origin of project <name>`. It is a read, so it runs inside a job too. Exit 0.

## `branch delete <branch> [--unmerged]`

Deletes one branch on origin with `git push --porcelain --force-with-lease=refs/heads/<branch>:<tip> origin :refs/heads/<branch>`, `<tip>` the one `git ls-remote --symref origin HEAD refs/heads/<branch>` just listed, and prints `deleted <branch> on origin (<commit>)`, exit 0. Like a push, it never asks for a password and runs no hook of the checkout's, nor a program its config or origin's URL names. Refused, exit 1, nothing deleted, with `arthur github: <branch> not deleted on origin: <why>`, `<why>` being:

- `<folder> has it checked out`: the checkout's own branch, main;
- `it is the branch of job <id>, which has not ended (<state>)`: `arthur jobs` shows it; once it ended, the delete goes on;
- `it is origin's default branch`: the one origin's `HEAD` names;
- `origin has no such branch`: never pushed, or deleted already, so a second delete is refused;
- `its tip <commit> is not in <main>; --unmerged deletes it all the same`: the checkout's main does not hold the tip, or does not have it; `--unmerged`, on the owner's word only, deletes it anyway;
- origin's refusal of the push, such as `[rejected] (stale info)`: the lease, when the tip moved since the listing, or `[remote rejected] (<why>)`, or git's first error line.

An origin it may not reach is refused as "Refused" below says. It is a write, so a job's call is refused before any of it.

## `branch sweep`

Deletes origin's `arthur/*` branches that nothing needs any more, the ones jobs left before Arthur deleted a pruned job's branch itself (`packages/github/docs/github.md`, "Branches on origin"). It lists them with `git ls-remote --symref origin HEAD 'refs/heads/arthur/*'`, and deletes, in one `git push --porcelain origin --force-with-lease=<ref>:<tip>... :<ref>...`, each one that is:

- named `arthur/<job id>`, `<date>-<kind>-<8 hex digits>` as a spawn names a job's branch;
- of a job that is gone: no record in `arthur jobs`;
- at a tip the checkout's main holds (`git merge-base --is-ancestor <tip> HEAD`); a tip the checkout does not have is not held.

Every other one is kept. The lease deletes a branch only while origin still has the tip it listed, so a commit pushed in between keeps it. Like a push, it never asks for a password and runs no hook of the checkout's, nor a program its config or origin's URL names. A branch's push record (`.arthur/github/pushed/<job id>`) goes with it.

Each branch is one line, in origin's order, then a count:

- `deleted <branch> (<commit>)`;
- `kept <branch>: <why>`, `<why>` being `not arthur/<job id>`, `its job still exists; arthur prune <id> frees it`, `its tip <commit> is not in <main>`, or origin's refusal of the delete, such as `[rejected] (stale info)` (the lease) or `[remote rejected] (<why>)`;
- `<n> deleted, <m> kept`, or with none on origin `no arthur/* branches on origin of project <name>`.

`--dry-run` deletes nothing: `would delete <branch> (<commit>)` for each one it would delete, then `--dry-run: <n> would be deleted, <m> kept; nothing deleted`. Run it first, and the sweep itself once the owner has read the list.

Exit 0, or 1 when origin refused a delete: run the sweep again for the branches it kept that way.

## Refused

As `arthur github --help` says, and exit 1, nothing deleted, for an origin any verb may not reach: `origin's branches of project <name> not listed: <why>`, `<why>` being `<folder> has no origin remote`, the checkout's own config setting a key that may name a program (`<file> sets <key>, which a job can write and which may name a program Arthur's git would run; remove it, or set it in your ~/.gitconfig`), or git's first error line (origin's URL, which may hold a credential, said as `origin`). `branch sweep` and `branch delete` are writes, so a job's call is refused before any of it; `branch list` runs in a job.
