# AR0699 - Review 1

- Job: 2026-11-16-review-06fd14c5
- Branch: arthur/2026-11-13-worker-c147cfc8
- Commit reviewed: 07a9db903d96e10dfc49370a8b87f13f8757a3ab
- Verdict: FAIL

## Final message

## Findings

1. **`packages/delivery/src/changelog.ts:125`: if you delete the config refusal, no test fails.** `fetchTags` calls `checkConfig(root)` and returns when a key in the shared `.git/config` is not on the allowed list, so that a key a job wrote (`remote.origin.uploadpack`, `include.path`, a `url.*.insteadOf`) cannot make the merge's `git fetch` run a program outside the sandbox.
   - I deleted that line by hand (`if (refusal !== "") return …`) and ran `merge-outcome.test.ts`, `changelog.test.ts` and `merge*.test.ts`: 65 tests, 64 pass, 0 fail.
   - The worker's own table lists this mutant as a survivor. Disabling a refusal that no test catches fails the branch under review.md.

2. **`packages/delivery/src/changelog.ts:127`: if you drop `--refmap=`, no test fails, and that flag is what stops a job from moving local refs.** `npm run mutate` printed `survived: … "--no-tags", "--no-prune"]` with `--refmap=` removed.
   - `checkConfig` allows `remote.<name>.fetch`. Without `--refmap=`, a `remote.origin.fetch` refspec that a job wrote gets applied to the fetched tags.
   - I tried it in a temporary repository (refspec passed with `-c`, same effect as config): `-c remote.origin.fetch=+refs/tags/v0.1.0:refs/heads/work` plus the branch's fetch without `--refmap=` force-moved local branch `work` from `503bf5c4…` to origin's tag `4576cd5c…`. Its own commit was dropped from the branch. With `--refmap=` the branch stayed at `503bf5c4…`.
   - That is lost work, and it breaks the promise in the code comment and in `docs/commands/changelog.md` that only the given refspec is used and that a tag already in the checkout is never moved. A key behavior whose mutant survives fails the branch.

3. **`packages/delivery/src/changelog.ts:126-128`: none of `fetchTags`'s other guards has a test that fails when the guard is removed.**
   - My runs saw `GIT_TERMINAL_PROMPT: "-1"` survive. The worker's four runs also report `GIT_PROTOCOL_FROM_USER` set to 1 or -1, `--no-tags` dropped, `core.fsmonitor=true`, `...pins` dropped and `--no-replace-objects` dropped as survivors, each named in its table.
   - `GIT_PROTOCOL_FROM_USER=0` is what leaves git only the safe transports for an origin URL a job may have rewritten (`remote.*.url` is allowed). Removing it goes unnoticed because the test's global config sets `protocol.file.allow=always`.
   - The github plugin already tests the same guards (`github-git.ts`'s `quiet()` and its tests in `github.test.ts`). The worker named that model and did not follow it.

## Notes
- (minor) `packages/delivery/src/changelog.ts:125`: the config refusal's line does not match the docs. It prints `tags not fetched from origin: <refusal>` without the `; CHANGELOG.md counts the tags of <checkout>` ending, and `merge.md` step 7 and `changelog.md` "Releases" name only the `git fetch exited <n>` / `timed out` forms.
- (minor) `packages/delivery/src/changelog.ts:112-120`: a commit that is both a version change and the target of another version's `v<x.y.z>` tag, or two tags on one commit, makes two releases with the same `at`. The second shows `No merged ticket in this release.`
- (minor) `packages/delivery/src/merge-command.ts:165`: the worker's message says the branch adds 2 lines to this file (+3/−1). The diff is +1/−1, and the counted size goes to 220 because the longer line now counts once more for width.

## Checks (on 07a9db90)
- `npm run check`: `tsc` passed.
- `npm test`: 1869 tests, 1805 pass, 0 fail, 0 cancelled, 64 skipped. My first run of `npm run check && npm test` gave its counts to a grep that dropped them, so the counts above come from a second `npm test` run.
- `npm run mutate`, run twice:
  - First call: 21 mutants, 19 caught, 2 survived, 76 not run (time).
  - Second call: 38 mutants, 33 caught, 5 survived, 59 not run (time).
  - Survivors: the two equivalent mutants at `merge-command.ts:165`, `GIT_TERMINAL_PROMPT "-1"`, `FETCH_MS / 1001`, and `--refmap=` dropped.
  - I did not finish the remaining 59. The worker reports 97 mutants, 15 survived, over four calls.
- Hand mutation: `changelog.ts:125` deleted, then `node --import @arthur/core/testing --test` on the delivery `merge-outcome`, `changelog` and `merge*` test files: 65 tests, 64 pass, 0 fail. Restored with `git checkout --`; the checkout is clean at 07a9db90.
- Git behavior in a temporary repository (refspec passed with `-c`, since the sandbox refused writing it to `.git/config`): a `remote.origin.fetch` refspec force-moves a local branch when the fetch has no `--refmap=`, and leaves it alone when it has one.

FAIL