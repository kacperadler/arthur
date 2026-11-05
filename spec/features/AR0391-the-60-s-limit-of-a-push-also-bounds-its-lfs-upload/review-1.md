# AR0391 - Review 1

- Job: 2026-11-05-review-4acd898f
- Branch: arthur/2026-11-05-worker-52b0021b
- Commit reviewed: cb0b129d651a7630d288a82c0ea1daf371913f29
- Verdict: PASS

## Final message

I found no blocking findings. The branch does what AR0391 asks. `git lfs push origin <ref>` is now killed only after 60 s with no output on stderr, and the `git push` after it keeps its fixed 60 s limit.

- **How it works:** in `packages/github/src/github-git.ts:33-43`, `gitAway` restarts its timer on each stderr chunk when `limit === "progress"`, and only the LFS call at `:79` passes that limit, with `GIT_LFS_FORCE_PROGRESS=1`. `git push`, `ls-remote` and the delete keep the default `"end"`.
- **Messages:** a stalled upload reports `no progress in 60 s`; a fixed-limit kill still reports `no end in 60 s` (`:48`). Splitting stderr on `\r` as well as `\n` keeps git-lfs's error line from being joined to the progress line before it.
- **Test:** the new test in `packages/github/test/github.test.ts:688-745` covers three cases: an upload that keeps printing for about two minutes is pushed, a stalled upload is killed at 60 s, and a `git push` that prints but never ends is still killed at exactly 60 s. The existing LFS failure test now prints a `\r` progress line before its error.
- **Docs:** the "Pushes" section of `packages/github/docs/github.md` describes the new limit and both messages. No other docs mention the old fixed limit for the LFS upload.
- **Structure:** the worker's message matches the diff (3 files, 1 commit). No file moved into yellow or red, nothing outside `@arthur/core` is imported, and nothing was added beyond what the fix needs.

## Notes
- (minor) packages/github/src/github-git.ts:47: one mutant survived. Removing `&& !line.includes("failed to push some refs")` from the filter goes uncaught. That filter was there before this branch; the branch only changed the split on the same line.
- (risk) packages/github/src/github-git.ts:43: the stderr buffer has no size limit. With progress forced on, `err` collects every progress update for the whole upload. Memory grows with how long the upload runs (not measured).
- (risk) packages/github/src/github-git.ts:79: the real git-lfs binary was never run. The worker says it isn't installed on their machine. The tests use a fake that only prints progress when `GIT_LFS_FORCE_PROGRESS=1` is set, so the claim that a real stalled upload goes silent rests on reading the git-lfs source.

## Checks (on cb0b129d)
- `npm run check && npm test` (timeout 1800): tsc clean. The test results were cut off by my output filter, so I ran `npm test` again: tests 1551, pass 1487, fail 0, skipped 64, exit 0.
- `npm run mutate`: 25 mutants, 24 caught, 1 survived, 9 not run (--max 25). The survivor is the pre-existing filter in the notes.
- Hand mutation: I turned off the timer restart (`limit === "progress"` → `limit === "never"`) and ran `node --import @arthur/core/testing --test --test-name-pattern="without progress" test/github.test.ts`: pass 0, fail 1. I restored the file with `git checkout -- src/github-git.ts`, and `git status --short` came back empty.

PASS