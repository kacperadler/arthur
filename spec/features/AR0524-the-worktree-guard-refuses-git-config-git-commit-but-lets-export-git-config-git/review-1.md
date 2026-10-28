# AR0524 - Review 1

- Job: 2026-10-28-review-b1141a21
- Branch: arthur/2026-10-28-worker-bd3b91f9
- Commit reviewed: ee6358748ce4341f7b804e8550c9cea09bea8c4d
- Verdict: PASS

## Final message

I found no blocking findings. The branch does what AR0524 asks: `export` (and `declare -x`) of `GIT_CONFIG_*`, `HOME` or `XDG_CONFIG_HOME` before `git` in the same bash call is now refused with the same line the prefixed form gets. The test covers the ticket's exact command, a `HOME` export and an `XDG_CONFIG_HOME` export, and it fails without the fix.

**Notes (not blocking):**
- **Ways around it that I confirmed** (each passes `worktreeRefusal`). They should be added to F1 or to a new finding:
  - A function defined before the export and called after it: `f() { git c a.c d; }; export GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=alias.c GIT_CONFIG_VALUE_0=config; f`, and `cd() { git status; }; export HOME=/tmp/h; cd .`. Function bodies are checked when they are defined, which is before `configured` is filled (`worktree-guard.ts:101,125`).
  - `trap "git status" EXIT; export HOME=/tmp/h`.
  - A variable name built at run time: `x=HOME; export $x=/tmp/h; git status` and `declare -x "$x=/tmp/h"`.
  - Ways to set a variable that the worker's F1 does not list: `let HOME=5`, `declare -n r=HOME; r=/tmp/h`, and `: ${GIT_CONFIG_COUNT:=1}; export GIT_CONFIG_COUNT`. F1 already has `for` and `read`.
- **Forms that are correctly refused:** `builtin`/`command`/`\export`/`"export"`; `export` inside `if`, `{ }`, `for`, `case`, `!`, `time`, `f() { … }`, `eval "…"`, a bash heredoc, `$( )` and backticks; `HOME=(…)`; `((HOME=5))`; `set -a; GIT_CONFIG_COUNT=1`; a later `env`, `timeout`, `exec`, `nohup`, `/usr/bin/git`, `find -exec git` or `xargs git`.
- **Files outside the ticket's "In" list:** `worktree-guard.ts` had to change, because bash parsing lives there and `git-writes.ts` only sees the prefix words. The final message describes that change and gives a reason for the `docs/deploy.md` change.
- **One mutation the tests miss:** widening `XDG_CONFIG_HOME` to `XDG_CONFIG_HOME\w*` in `UNREAD`. This regex shape was already there before the branch, so it is minor.
- **Outside the range:** the `function f { … }` keyword form is not parsed at all; `function f { rm -rf <main>/x; }; f` passes too.

**Checks I ran:**
- `npm ci`: OK. `npm run check`: exit 0.
- `npm test`: tests 1230, pass 1169, fail 0, skipped 61, exit 0. The harness moved the first run to the background, and my mutation runs were editing the source while it ran, so I ran it again alone with output to a file. The figures are from that rerun and match the worker's.
- Mutations, each run against `packages/core/test/worktree-guard.test.ts` and then restored. The tests caught all of these:
  - not passing `configured` to `git`;
  - turning off the push into `configured`;
  - dropping the bare-assignment case;
  - dropping each of `export`, `declare`, `typeset`, `readonly` and `local`;
  - dropping the index part or the `+=` part of `UNREAD`;
  - dropping the `NOSYSTEM` exemption;
  - dropping `HOME` or `XDG_CONFIG_HOME` from `UNREAD`.
- I tried about 45 bash forms against `worktreeRefusal` with a throwaway test (results above), then removed it. `git status --short` is clean.
- `wc -l`: `worktree-guard.ts` is 200 lines (at the limit), `git-writes.ts` 125.
- In real bash, `function f { export HOME=/tmp/zz; }; f; echo $HOME` prints `/tmp/zz`, so a function's export does reach later commands.

PASS