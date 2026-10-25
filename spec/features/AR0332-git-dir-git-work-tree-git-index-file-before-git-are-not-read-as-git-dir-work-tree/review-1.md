# AR0332 - Review 1

- Job: 2026-10-25-review-79c6358f
- Branch: arthur/2026-10-25-worker-10b542de
- Commit reviewed: fd58467853fd3c0e5dd0da3387e9427bc6505915
- Verdict: PASS

## Final message

Verdict: PASS. The branch adds `GIT_INDEX_FILE` and `GIT_OBJECT_DIRECTORY` to the variables the guard reads before `git`, and the ticket's Done-means points hold. One gap remains open (the `~` form, first note below); it comes from code outside the range and needs its own ticket.

## Findings

None that block the merge.

- `packages/core/src/git-writes.ts:53`: the pattern now matches `GIT_(?:DIR|WORK_TREE|INDEX_FILE|OBJECT_DIRECTORY|COMMON_DIR)=`. The guard reads the variables both before `git` and after `env`.
- `packages/core/test/worktree-guard.test.ts:315-320`: all four forms in the ticket's Description are refused naming the main checkout: `GIT_WORK_TREE=`, `GIT_DIR=` with `GIT_WORK_TREE=` and `reset --hard`, `env GIT_WORK_TREE=`, and `GIT_INDEX_FILE=<main>/.git/index git add .`. A fifth case covers `env -u X GIT_OBJECT_DIRECTORY=…`. `GIT_COMMON_DIR=` was already covered on main (line 428). `GIT_AUTHOR_NAME=x git commit -m y` is in the passing list (line 368), and the test also runs it for real and checks that main's README and shared config stay the same.

## Notes

- **Still open, outside the range (`packages/core/src/shell-words.ts:194`):** the guard replaces `~` with the home folder only at the start of a word. Bash also expands `~` after the `=` of an assignment word, and of `env NAME=value`. These all pass the guard:
  - `GIT_WORK_TREE=~/acme git checkout -- .`
  - `GIT_INDEX_FILE=~/acme/.git/index git add .`
  - `env GIT_INDEX_FILE=~/acme/.git/index git add .`

  I ran the first one for real with `HOME` set to a temporary folder: it put main's changed `README.md` back to its committed text. The same call with `$HOME/acme/.git/index` is refused. The cause predates this branch and also affects `GIT_DIR` and `GIT_WORK_TREE`. Since main checkouts usually sit under `~`, it should become a finding or ticket.
- Calls that change nothing (`git status`, `git stash list`, `git hash-object -w`) still pass with these variables set, because the guard only checks the variables on calls that write. `git status` may refresh the stat data in the index file it is given, but leaves its entries as they are. Writing objects into main's `.git/objects` is what any worktree does anyway, since they all share it.
- Forms I tried that are refused correctly: double-quoted and single-quoted values, `env -i`, `env --`, `sudo`, `sudo -u x`, `X=1 env … nice -n 5 git`, `command env`, a subshell, `bash -c`, after `&&`, and `update-index`, `read-tree`, `rm --cached`. Paths outside main pass: `GIT_INDEX_FILE=/tmp/x`, `GIT_OBJECT_DIRECTORY=/tmp/o`.
- `findings.md` F1 (`env -C`, `sudo -D`) is out of this ticket, as the task says. It uses the made-up name `acme`, so nothing about the owner's work leaks.
- The worker's final message makes no claims to check: its run ended while waiting on `npm test`. There is one commit, `fix(AR0332): …`, in Conventional Commits form with the ticket id as scope.
- `worktree-guard.ts` is exactly 200 lines, which the size rule allows.

## Checks run (each under `timeout 300`, in the foreground)

- `npm run check` (tsc): exit 0.
- `node --test test/structure.test.ts`: 15/15 pass.
- `node --import @arthur/core/testing --test packages/core/test/worktree-guard.test.ts`: 11/11 pass.
- Mutations in `git-writes.ts`, each restored with `git checkout -- packages/core/src/git-writes.ts`. The tests caught all three, each with one failing test out of 11:
  - removing `INDEX_FILE` from the pattern;
  - removing `OBJECT_DIRECTORY`;
  - going back to the pattern before the branch.
- Throwaway probe scripts on a real repository and worktree under `/tmp/ar0332-probe-*`, deleted afterwards. They produced the bypass and pass/refuse results above.

PASS