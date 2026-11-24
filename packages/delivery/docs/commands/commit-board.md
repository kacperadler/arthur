# arthur commit-board

Usage: `arthur commit-board '<subject>' [--project <name>]`. Comes with the `delivery` plugin (AR0738; AR0667's plan, T2). For one project, the main one unless `--project` names another. A job may not run it.

Commits the project's board, on the branch its checkout has, as `<subject>`. It is how the coordinator and a project agent commit what Arthur's commands write on main, in place of `git commit`: the commit holds only the board's files, and the project's own check of what a commit holds always runs first, so none of them reaches main unchecked. It prints `committed <subject>: <commit>, <n> files`. When no board file changed it commits nothing and prints `nothing to commit: no file of <the paths below> changed in <checkout>`, exit code 0, so a second call is harmless.

## What it commits

Each of these files that differs from HEAD, a new and a deleted one included, staged before or not, and nothing else:

- `spec/build.json`, the board; `spec/decisions.jsonl`, the decision log; `spec/schedule.json`, the schedule's entries;
- every `.md` file under `spec/features/`, at any depth: tickets, plans, reviews, findings, outcomes;
- the reports `arthur ticket file` files and their pages: the `.md` files directly in `spec/quality/`, `spec/retro/` and `spec/pyramid/`, and the `.html` files directly in `spec/retro/` and `spec/pyramid/`;
- `CHANGELOG.md`, which a merge rebuilds and leaves uncommitted when its own `spec:` commit is refused (`arthur merge --help`, step 8).

Every other change in the checkout stays as it was, staged or unstaged: code, the vision and the roadmap, a ticket's attachment that is no `.md`, any other file under `spec/`. Those reach main on a worker's branch or by the owner's own commit.

## Steps

1. Takes the project's merge lock (`<delivery folder>/<project>/merge.lock`, `arthur merge --help`) for as long as it runs: a check that fails on main resets it, and a commit made on top of the merge commit meanwhile would go with it.
2. Asks the checkout's own Git config, as `arthur merge` does, before any git call that could run a program it names; every git call runs with the hooks off.
3. Lists the changed files under the paths above (`git status`), and refuses the whole commit when one of them is a symlink.
4. Stages exactly those files, then runs the project's own check, since the hooks are off: the `commit-msg` script of the `package.json` HEAD holds, as `npm run --silent commit-msg -- <Git's COMMIT_EDITMSG file>` with the subject written there, the way Git runs a `commit-msg` hook, in the sandbox of a merge's steps and on the PATH the nvm plugin answers for the checkout (`arthur merge --help`, step 8). Arthur's own runs `node test/other-projects.ts`, so a board file that names another project of the owner never reaches GitHub. A project that declares no such script commits without a check.
5. Commits those files alone (`git commit -m <subject> -- <files>`). Nothing is pushed: the next `arthur merge` that goes in pushes main.

## Refused

Exit code 1, nothing committed and none of the board's files left staged:

- A merge of the project in a run, or another `arthur commit-board`: `main of <project> is held by pid <pid>, a merge or another commit; nothing committed: run it again once that ended`.
- The checkout's own Git config sets a key that may name a program: `<file> sets <key>, …; nothing committed`.
- A symlink among the changed files, new or in a tracked file's place: `<files>: a symlink, which this commit never holds; remove it; nothing committed`. A tracked symlink's removal is committed.
- The project's check refuses, or a file changed while it ran: `<subject> not committed: npm run commit-msg refused: <its last line>; fix what it names, then run it again`, or `… not committed: <files> changed while npm run commit-msg ran; …`. Reword what the check names (a ticket's line, a schedule entry) and run the command again; never commit past it with `git commit`.
- The check still running after `merge.stepSeconds` (the delivery plugin's option, an hour by default) is killed: `<subject> not committed: npm run commit-msg refused: timed out after <n> s; …`.
- A project whose folder is no Git checkout: `git status in <folder> failed: <git's words>; nothing committed`.
- Git's own refusal of the commit (no identity): `<subject> not committed: <git's last line>; …`.
- A project not in the list: `no project <name> in the project list`.

Wrong usage (no subject or an empty one, more than one word, a word starting with `-`) prints `usage: arthur commit-board '<subject>' [--project <name>]` and exits 2.

## For other plugins

The plugin provides `delivery.commit`, `{ project, subject, paths }` to the same line or a throw: the steps above for the pathspecs `paths` in place of the board's. `arthur init` (the projects plugin) commits the files it wrote with it.
