# AR0471 - Review 3

- Job: 2026-10-27-review-50ec625c
- Branch: arthur/2026-10-27-worker-c28e3457
- Commit reviewed: 9666e1fe4e82d6e456b37280b942cca2d755a86f
- Verdict: FAIL

## Final message

**FAIL.** The round-2 finding is fixed, but the new word splitting opens four ways to delete the main checkout's README. The base refuses all four.

## Findings

1. **`packages/core/src/shell-words.ts:91-92`: the split ignores `IFS`.** The guard always splits a fallback at spaces. Bash splits at `IFS`, and does not split at all when `IFS` is empty. The setup is the branch's own: the link `a b` in the worktree that leads to the main checkout (`worktree-guard.test.ts:83`).
   - `IFS=; rm ${x:-a b}/README.md` passes at the tip and is refused at the base. Bash runs `rm 'a b/README.md'`, which deletes the main README through the link.
   - `IFS=x; rm ${x:-a b}/README.md` passes the same way, for the same reason.
   - Before this branch the fallback was joined into one word, `a b/README.md`, which is what bash sees here. This is a regression, not a gap that was already there.

2. **`packages/core/src/shell-words.ts:91`: an assignment after `time` or `!` is split.** The no-split check only looks at the first word that is not an assignment, and allows only none, `export`, `declare`, `typeset`, `readonly` or `local`. `time` and `!` are reserved words, and bash still reads the next word as an assignment, so it does not split it.
   - `time OLDPWD=${x:-a b} cd -; rm README.md` passes at the tip and is refused at the base. Bash sets OLDPWD to `a b`, moves into the main checkout and deletes its README.
   - `! OLDPWD=${x:-a b} cd -; rm README.md` passes the same way.
   - The worker wrote that splitting in an assignment "would let `OLDPWD=${x:-a b} cd -` read OLDPWD as `a` instead of `a b`". These two prefixes open exactly that bypass.

   No row in `worktree-guard.test.ts` covers `IFS`, `time` or `!` with a fallback. A cautious fix: wherever the split could differ from what bash does, check both readings, the split words and the joined word. For `rm`, the extra words can only add refusals; for OLDPWD, two possible readings could be refused as UNKNOWN.

## Notes
- **Round-2 finding fixed:** `rm ${x:-> …}`, `${x:-a 2> …}`, `${x:-< …}` and `${x:-# …}` are now refused naming the main checkout.
- **Probes the branch reads as bash does** (I checked each case in real bash 5.2.21):
  - `rm ${x:-a\ b}/README.md` and `rm ${x:-"a b"}/README.md`: refused.
  - `declare -x OLDPWD=${x:-a b}; cd -; rm README.md`: refused.
  - `rm ${x:-a ${y:-../../acme/README.md}}`: refused.
  - `rm ${x:-a b}/README.md`: passes. This is correct: bash splits it, and the base wrongly refused it.
  - `rm ${x:-a>../../acme/README.md}`: passes. Bash gives one word inside the worktree.
  - `builtin export` and `command export`: split, as bash 5.2 does.
- **Older gap, not caused by this branch:** `IFS=x; rm ${x:-ax../../acme/README.md}` passes at both base and tip, while bash deletes the main README. It needs no link.
- **F1** (a command substitution inside a fallback word) is out of scope, as you said, and is not counted.
- `shell-words.ts` and `worktree-guard.ts` are both at exactly 200 lines, as the worker said, so either fix needs lines freed or a split.

## Checks
- `npm run check` (tsc): exit 0.
- `node --test packages/core/test/worktree-guard.test.ts packages/core/test/env-guard.test.ts packages/core/test/env.test.ts test/structure.test.ts`: 47 tests, 47 pass, 0 fail, 0 skipped. This matches the worker's count.
- **Probe rows**, added to the guard test for the run only, with the assertion turned into a log line so every mismatch shows:
  - At the tip, the four commands in findings 1 and 2 come back `undefined` (passed) where the main checkout was expected.
  - With the base's `shell-words.ts`, all four are refused naming the main checkout.
- **Real bash**, in a `mktemp -d` folder with `acme/README.md` and a link `a b` to it from `wt/job`, removed afterwards:
  - `IFS=; rm ${x:-a b}/README.md` deleted the README.
  - `time OLDPWD=${x:-a b} cd -; rm README.md` deleted it.
  - `IFS=x; rm ${x:-ax../../acme/README.md}` deleted it.
- **Mutations, both caught** by the guard test (it fails):
  - passing `false` as `plain` when the fallback is read;
  - never treating an assignment as unsplit (`false &&` in `whole`).
- All throwaway edits were undone with `git checkout`; `git status --short` is empty.

FAIL