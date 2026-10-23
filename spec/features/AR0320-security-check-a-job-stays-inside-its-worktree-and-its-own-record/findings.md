# AR0320 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

`- Budget:` is optional: set it, in USD, only when the ticket this finding becomes is expected to cost more than the autopilot default, and leave the line out otherwise. `h merge` copies it into the ticket's JSON block as `budget`, which `h ticket status --autopilot` passes to `--budget`, capped at `H_AUTOPILOT_BUDGET_MAX`.

Every entry comes from `check.md` beside this file, which holds the rows and how each was checked. Each is written as a missing check: the input the guard does not cover and the check that would.

## F1. A job is not isolated from Arthur's code, config and the user's own files (AR0311 F1, confirmed)

- Kind: risk
- Severity: critical
- Found by: 2026-10-23-ar0320-security-check-4dea199b (worker), 2026-10-23
- Where: `packages/core/src/job-place.ts:40` (the guarded places: the home folder, the worktrees folder, the main checkout, the other projects), `packages/core/src/job-scope.ts:63-68` (the scope caps CPU and memory only), `docs/deploy.md:30`
- Rule: a job never writes Arthur's code or config.
- What: in the layout of `docs/setup.md` (config and `.env` in `~/arthur`, home `~/arthur/.arthur`), a tool call that writes `~/arthur/arthur.config.ts`, a file under `~/arthur/packages/`, `~/arthur/.env`, `~/.gitconfig`, `~/.ssh/authorized_keys` or `~/.config/systemd/user/arthur.service` passes the worktree guard, since none of them is in a guarded place unless Arthur's own repository happens to be a declared project; and the job's process, as Arthur's Linux user, can do the same through any program the parser does not read (`node -e`, `python3 -c`, `tar -C`, a path in a variable), which the guard documents as its limit (`worktree-guard.ts:55-60`).
- Suggestion: two steps. First, in the guard: the runner writes into the record a `guarded` file with the folder of the config, Arthur's install (the package root of `import.meta.dirname`), `~/.ssh`, `~/.config/systemd` and `~/.gitconfig`, and `jobPlace` adds them to the places with their own names ("Arthur's config folder", "Arthur's install", "the user's SSH folder"); a test in `worktree-guard.test.ts` with a write into each. Second, the real bound, its own ticket: run each job's agent under a sandbox (bubblewrap or Landlock, or a Linux user per job) with the worktree and `/tmp` writable and the home folder, the config folder, `~/.ssh` and the other checkouts read-only or hidden, and without the user manager's bus (`systemd-run --user` from a job starts a process outside its scope). Out: the parser stays the mistake guard it is.
- Status: open

## F2. `git config` from a job rewrites the shared repository's config and the user's (AR0311 F2, confirmed)

- Kind: risk
- Severity: high
- Found by: 2026-10-23-ar0320-security-check-4dea199b (worker), 2026-10-23
- Where: `packages/core/src/git-writes.ts:4` (no `config` among the writing subcommands), `packages/core/src/worktree-guard.ts:128-137`, `:60` and `docs/deploy.md:34` (named as a limit)
- Rule: a job never writes the shared repository's config or hooks.
- What: `git config core.hooksPath <dir>`, `git config core.fsmonitor <program>`, `git config receive.denyCurrentBranch ignore`, also as `git -C <main> config …`, `git config --file <root>/.git/config …` and `git config --global …`, pass the guard; the first two make every later git call of Arthur in the main checkout (`arthur merge`, a status) run a program of the job's choice, after the job ended and outside its scope; the third lets a `push .` into `main` through that git refuses by default (see F3).
- Suggestion: in `gitCall`, `config` with any argument that sets or unsets (no `--get*`, `--list`, `-l`, `--show-origin`) and not `--worktree` or a `--file` outside the guarded places is a write of the main checkout: `refusal(place, place.root, "git config <key>")`; `--global` and `--system` likewise. Tests in `worktree-guard.test.ts`: each form above refused, `git config --get user.name`, `git config -l` and `git config --worktree x y` passing. Beside it (AR0324): Arthur's own git calls on a main checkout with `-c core.hooksPath=/dev/null -c core.fsmonitor=false`.
- Status: open

## F3. A job can point its own worktree at `main`, after which every allowed git write lands on main

- Kind: risk
- Severity: high
- Found by: 2026-10-23-ar0320-security-check-4dea199b (worker), 2026-10-23
- Where: `packages/core/src/git-writes.ts:4` (`switch`, `checkout`, `symbolic-ref` write "the checkout they run in"), `packages/core/src/worktree-guard.ts:135` (that checkout is the worktree, so it passes), `:134` (only `update-ref` looks at the ref), `:156` (the worktree's own `.git` file is inside the worktree)
- Rule: a job never writes main.
- What: three calls pass the guard from the job's worktree: `git switch --ignore-other-worktrees main` (or `git checkout --ignore-other-worktrees main`), `git symbolic-ref HEAD refs/heads/main`, and a write of the worktree's `.git` file with `gitdir: <root>/.git`. After each, run in a temporary repository, a plain `git commit` in the worktree moved `main`, and the main checkout's index no longer matched its tree. Git itself refuses `git branch -f main`, `git push . HEAD:refs/heads/main` and `git fetch . HEAD:refs/heads/main` for a branch checked out elsewhere, so those need no check of ours; `git tag -f` it allows (a tag is no ref Arthur merges from).
- Suggestion: in the guard's `git`: refuse `--ignore-other-worktrees` on `switch` and `checkout`; refuse `symbolic-ref HEAD <ref>` when `<ref>` is not `refs/heads/<place.branch>` (as `update-ref` is handled at `:134`); and in `refusal`, treat `<worktree>/.git` (a file, the worktree's link to the repository) as the main checkout for `edit`, `write` and any bash write. Tests in `worktree-guard.test.ts`: each of the four refused naming the main checkout; `git switch -c topic`, `git checkout -- .`, `git symbolic-ref HEAD refs/heads/<own branch>` passing. Defence in depth, AR0324: before a merge, refuse when `main`'s tip is not the commit Arthur last left there.
- Status: open

## F4. `GIT_DIR=`, `GIT_WORK_TREE=`, `GIT_INDEX_FILE=` before `git` are not read as `--git-dir`, `--work-tree`

- Kind: bug
- Severity: medium
- Found by: 2026-10-23-ar0320-security-check-4dea199b (worker), 2026-10-23
- Where: `packages/core/src/worktree-guard.ts:45-51` (`commandIndex` skips `NAME=value` words and the options of `env`), `packages/core/src/git-writes.ts:6` (`VALUE_OPTIONS` names the options only)
- Rule: a git write aimed at a guarded place is refused.
- What: `git --work-tree=<main> checkout -- .` is refused, but `GIT_WORK_TREE=<main> git checkout -- .`, `GIT_DIR=<main>/.git GIT_WORK_TREE=<main> git reset --hard`, `env GIT_WORK_TREE=<main> git checkout -- .` and `GIT_INDEX_FILE=<root>/.git/index git add .` pass; git reads the variables as it reads the options (git(1), "Environment variables"), and the first, run in a temporary repository, rewrote the main checkout's `README.md`.
- Suggestion: `commandIndex` returns the assignment words it skipped (and the `NAME=value` arguments of `env`); the guard's `git` adds the values of `GIT_DIR`, `GIT_WORK_TREE`, `GIT_INDEX_FILE`, `GIT_OBJECT_DIRECTORY` and `GIT_COMMON_DIR` to `trees`. Tests: the four forms refused naming the main checkout; `GIT_AUTHOR_NAME=x git commit -m y` passing.
- Status: open

## F5. `cd -`, `pushd` with no operand and `$OLDPWD` are read as `cd $HOME`

- Kind: bug
- Severity: low
- Found by: 2026-10-23-ar0320-security-check-4dea199b (worker), 2026-10-23
- Where: `packages/core/src/worktree-guard.ts:91-94` (`operands` drops `-`, so `operands[0]` is undefined and the folder is `$HOME`; `pushd` alone is treated the same)
- Rule: a path is resolved from where the commands before it left.
- What: `cd <main>; cd -; cd -; rm README.md` passes: bash is back in the main checkout, the guard thinks it is in the user's home. The same for `pushd <main>; pushd; pushd; rm README.md` and `OLDPWD=<main>; cd -; rm README.md`. (`cd ~-` is refused by luck: `~-` is kept as a literal relative path.)
- Suggestion: keep `previous` beside `cwd`; `cd -` and `cd $OLDPWD`/`~-` go to it, `pushd` with no operand swaps `cwd` with the top of `pushed`; an assignment of `OLDPWD` sets it. Tests: the three commands refused naming the main checkout.
- Status: open

## F6. `$ARTHUR_JOB`, the one variable every job's shell has that names a guarded place, is not expanded

- Kind: improvement
- Severity: low
- Found by: 2026-10-23-ar0320-security-check-4dea199b (worker), 2026-10-23
- Where: `packages/core/src/shell-words.ts:81-100` (`$HOME` and `~` expand to `home`; any other variable is nothing), `packages/core/src/worktree-guard.ts:98`, `:101`, `:138` (the guard passes `process.env.HOME` only)
- Rule: a job never writes its record by a tool call (`check.md`, "The places"; the record is the wrapper's).
- What: `echo x > $ARTHUR_JOB/result` and `echo x > "$ARTHUR_JOB"/../<other job>/result` pass the guard, while the same paths spelled out are refused: the variable's value is a path the guard knows (`worktreeGuard` reads it at `:165`) but the parser turns it into nothing, so the write goes to `/result`, which no place holds. A documented limit for variables in general (`:57`); for this one variable the guard has the value in hand.
- Suggestion: `shellCommands` takes a map of known variables (`HOME`, `ARTHUR_JOB`) in place of `home`, and the guard passes both. Tests: the two commands refused naming the home folder; `echo $ARTHUR_JOB` passing.
- Status: open

## F7. The git commands that rewrite the shared repository pass as a documented limit

- Kind: risk
- Severity: low
- Found by: 2026-10-23-ar0320-security-check-4dea199b (worker), 2026-10-23
- Where: `packages/core/src/git-writes.ts:4` (none of `gc`, `prune`, `repack`, `reflog`, `maintenance`, `worktree prune`, `worktree add` outside the worktrees folder), `packages/core/src/worktree-guard.ts:59`, `docs/deploy.md:34`
- Rule: a job never writes the shared repository.
- What: `git gc --prune=now`, `git reflog expire --expire=now --all`, `git -C <main> gc`, `git -C <main> worktree prune` and `git worktree add /tmp/x -b h/x` pass the guard; they rewrite `<root>/.git`, which every worktree and the main checkout share: unreachable objects of another job's reset, a stash entry's reflog, a worktree's metadata, a new branch.
- Suggestion: `gc`, `prune`, `repack`, `reflog` (any but `show`), `maintenance`, `filter-repo`, `worktree prune` and `worktree add` with a target outside the worktrees folder are a write of the main checkout wherever they run: `refusal(place, place.root, "git <sub>")`. Tests: each refused naming the main checkout; `git reflog show` and `git worktree list` passing.
- Status: open

## F8. A writing command after a `cd` into a guarded place with an operand built at run time passes

- Kind: improvement
- Severity: low
- Found by: 2026-10-23-ar0320-security-check-4dea199b (worker), 2026-10-23
- Where: `packages/core/src/worktree-guard.ts:104` (`theirs(args)` on a list that holds no path once `$f` became nothing)
- Rule: a writing command run in a guarded place is refused.
- What: `cd <main>` then `for f in *; do rm $f; done` passes: the guard knows the shell is in the main checkout, but `rm $f` has no operand it can see, so it checks none. The same for `rm "$file"` and `mv $a $b` after any `cd` into a guarded place.
- Suggestion: when `cwd` is in a guarded place, a command in `WRITES`, `COPIES`, `dd`, `ln`, `sed -i`/`perl -i`, or a redirect, is refused whatever its operands, naming the folder (`refusal(place, cwd, verb)`). Tests: the loop refused naming the main checkout; `cd <main> && ls` and `cd <main> && git log` passing (already rows 144-148 of the main test).
- Status: open
