# AR0496 - Review 5

- Job: 2026-10-28-review-67d09107
- Branch: arthur/2026-10-28-worker-821d07d3
- Commit reviewed: 6db38260b84e0bdd78cd73d5562f3788cf3b1cb2
- Verdict: FAIL

## Final message

## AR0496 round 3 review: branch `arthur/2026-10-28-worker-821d07d3` at `6db38260`

The branch fails. The exception for an index form like `declare -a arr[0]=1` lets `HOME`, `PWD` and `ARTHUR_JOB` through when the shell reads the word as a glob, and real bash then deletes the main checkout's README.

### Findings

1. **`packages/core/src/worktree-guard.ts:95`: the index exception lets a known variable through.** The new check skips any word matching `^[A-Za-z_]\w*\[[^\]]*\]\+?=`. That covers `HOM[E]=…`, `PW[D]=…` and `ARTHUR_JO[B]=…`, where the `[…]` is a bracket glob that matches the name's last letter. The later check `/^(?:HOME|ARTHUR_JOB|PWD)(?:\[…\])?\+?=/` does not catch them, because the text before `[` is not a known name.
   - **Plain bash** reads `name[x]=` as an assignment, which is what the worker relied on. Bash only does that when it sees the declaration builtin directly.
   - **Where the shell globs the word instead:** behind `command` or `builtin` in bash, and in plain `export` in dash, which is `/bin/sh` here. There the word matches a folder named `HOME=..` that the job can create in its own worktree.
   - **Guard verdict:** I inserted each row below into the test table one at a time, expecting the unknown refusal. Every one passed the guard (`undefined`):
     - `command export HOM[E]=../../acme; bash -c 'rm $HOME/README.md'`
     - `builtin export HOM[E]=../../acme; bash -c 'rm $HOME/README.md'`
     - `sh -c 'export HOM[E]=../../acme; rm $HOME/README.md'`
     - `command declare -x HOM[E]=../../acme; rm ~/README.md`
     - `command export PW[D]=../../acme; rm $PWD/README.md`
     - `command export ARTHUR_JO[B]=../../acme; rm $ARTHUR_JOB/README.md`
   - **Real shells** (bash 5.2.21 and dash, in a temporary folder with `w/x/HOME=..` and `w/x/acme` created):
     - `command export HOM[E]=../../acme; echo $HOME` printed `../../acme`. The same held for `builtin export`, for dash's `export` and `command export`, for `bash --posix` with `builtin export`, and for `command declare -x` and `command local`.
     - The first and third commands above deleted `acme/README.md`: 0 files left in both runs.
   - **Why it fails the branch:** the decision of 2026-10-28 (AR-D239) says to refuse a declaration whose name holds an unquoted `[` before its `=`. The coordinator accepted the index exception only on the condition that no index form lets `HOME`, `ARTHUR_JOB` or `PWD` through. Six do. This is a security bypass with no test row covering it.
   - **Possible fix:** keep the exception only where the text before `[`, plus one character, cannot spell a known name. Or apply it only when the declaration builtin is not run through `command` or `builtin` and the shell is bash.

2. **Same line: an extglob name passes too.** The guard passes `bash -O extglob -c 'export HOM@(E)=../../acme; rm $HOME/README.md'`. In real bash, `bash -O extglob -c 'export HOM@(E)=../../acme; echo $HOME'` printed `../../acme`. The decision lists only `{ * ? [`, so this goes past its letter. It is the same class of bypass, though: a name made at run time by a glob.

### Notes (not blocking)
- The worker's message says AR0496 still has no changelog entry, and the range adds none.
- F1 (`for`, `read`, `printf -v`, a nameref, `eval $v=…`) is still open in `findings.md`, as the worker says.

### Checks run
- `npm ci`: exit 0.
- `npm run check`: `tsc`, exit 0.
- `npm test`:
  - first run: exit 0;
  - second run, written to a file in the worktree that I then deleted: `tests 1230, pass 1169, fail 0, cancelled 0, skipped 61`, exit 0.

  This matches the worker's numbers.
- **Mutations** of line 95, each run against `packages/core/test/worktree-guard.test.ts`: the tests caught all six.
  - `[` removed from the character class;
  - `{` removed;
  - the escape removal dropped;
  - the index exception removed;
  - `command.dynamic` replaced by `false`;
  - `index > at` changed to `index >= 0`.
- **Throwaway bypass rows:** the eight commands from findings 1 and 2 above, inserted one at a time. All passed the guard where the unknown refusal was expected. A plain bash `export HOM[E]=…` row also passed the guard, but plain bash does not glob it, so it is no bypass on its own.
- **Real bash and dash runs** as in finding 1: `HOME` was set and the README deleted.
- All throwaway edits were restored with `git checkout --`, and the temporary scripts and log were removed. `git status --short` is empty.

FAIL