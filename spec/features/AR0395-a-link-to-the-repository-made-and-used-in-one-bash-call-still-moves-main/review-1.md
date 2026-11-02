# AR0395 - Review 1

- Job: 2026-11-02-review-302a8f32
- Branch: arthur/2026-11-02-worker-3b09a3f0
- Commit reviewed: 47e6df6e0a969f5a6b0de601c5eaa4268cbf207a
- Verdict: PASS

## Final message

## Findings

None block the merge.

The ticket's fallback fix is in place. `packages/core/src/bash-refusal.ts:39-43` records every path a bash call writes with content: redirects, `mv`, `tee`, `sed -i`, the `cp` family, `ln` and `dd of=`. A git write is refused when its folder, `--git-dir`, `GIT_DIR`, `GIT_COMMON_DIR` or `--work-tree` is at or inside one of those paths (`:132`). The second pass gets those paths too (`:135`), so a write that runs after the git call is also caught, as in a function body or the next loop round. The ticket's example is refused with the message from `:20`. `docs/deploy.md:35` and the header comment of `bash-refusal.ts` now describe the new refusal, and nothing in docs, packages, README, roadmap or `.agents` still states the old gap. The worker's message explains why `bash-refusal.ts` is now yellow (207 lines) and logs a split as F2. You told me the core budget raise from 7092 to 7099 is already decided (AR-D461).

I ran 20 variants through `worktreeRefusal` in a throwaway test, then restored the file with `git checkout` (status clean). 19 were refused:
- `>>`, `--git-dir <path>` with a space, `exec 3>`, a `cat > l <<EOF` heredoc, `GIT_COMMON_DIR=`
- `cp -r` of a folder with `--git-dir=<copy>/.git`, `cp --target-directory=`, `install -D`, `rsync`
- a write inside a subshell's `cd`, and `cd … && cd -`
- `branch -f main`, `update-ref` (refused by an earlier check)
- `eval`, `env GIT_DIR=`, `sudo GIT_DIR=`, `timeout`, `-c core.worktree=`, `find -exec cp`

Only `export GIT_DIR=<l>; … > <l>; git commit` got through. That gap existed before this branch and the docs already name it ("a `GIT_DIR` exported by an earlier command"); it is noted below.

## Notes
- (security) packages/core/src/bash-refusal.ts:132: a GIT_DIR exported in the same call is not checked against what the call writes. `export GIT_DIR=/tmp/l; echo "gitdir: <root>/.git" > /tmp/l; git --work-tree=. commit -m x` gets past the guard. `docs/deploy.md` already lists an exported `GIT_DIR` as unseen, but the ticket names `GIT_DIR` among the ways in.
- (security) packages/core/src/job-sandbox.ts:74: confirms the worker's F1. `writable` gives the job the repository's whole `refs` folder, so a link a program writes can still move `refs/heads/main`. Only AR0361's merge check catches it afterwards.
- (minor) packages/core/test/worktree-guard.test.ts:1108: the false positive `cp <file> . && git commit` is refused on purpose; the test and the docs both say so.

## Checks
- `npm ci`, then `npm run check && npm test` in one call (timeout 1800 s): tsc passed; 1494 tests, 1430 pass, 0 fail, 64 skipped (411 s). This matches the worker's numbers.
- No timing test failed, so I did not run `limits.test.ts` alone.
- Throwaway probe test (`node --test --test-name-pattern=ZZPROBE`): 19 of 20 variants refused, as listed above.
- I did not run `npm run mutate`: your budget is small, and the worker reports a full run takes over 30 minutes. I also did not run any hand mutations. The worker's two hand mutations (recording `mkdir` as a write; dropping the written paths from the second pass) and its `--max 4` mutate result (4 caught, 0 survived) are its own claims; I have not reproduced them.

PASS