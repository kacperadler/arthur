# AR0390 - Review 1

- Job: 2026-11-03-review-851906ce
- Branch: arthur/2026-11-03-worker-bb81d62e
- Commit reviewed: bb3d12b4e8ad17621a2e0fd47215b1a3171646de
- Verdict: PASS

## Final message

## Findings

None block the merge. The branch takes the ticket's "or refuse" option, which Done means allows: refuse to place such a project on another machine and say so in `docs/deploy.md`.

- `packages/core/src/job-machine.ts:159-160`: `reach` checks the base and the spawn's `fetch` with `namesLfs` before the first `ssh` call. Its only caller, `jobs.ts:139`, calls it only for a machine that is not `local` and before `newJob`, so no record or worktree exists when the spawn is refused.
- `packages/core/src/git.ts:38`: `namesLfs` runs `git grep --quiet --fixed-strings -e filter=lfs <commit> -- ':(glob)**/.gitattributes'` through the existing `yes` helper. The test shows that the `**/` glob matches both the root file and a nested one.
- `packages/core/test/machine.test.ts:297`: the new test checks four things:
  - a nested LFS `.gitattributes` reached only through `fetch` is refused, with no SSH call, no record and nothing created on the machine;
  - a `.gitattributes` without `filter=lfs` still runs there to `ended`;
  - an LFS `.gitattributes` at the root of the base is refused, with no new SSH call;
  - the exact refusal message.
- The test catches these mutations by reading alone: dropping `fetch` from the list fails the first case, dropping `base` fails the last, and inverting the check fails the non-LFS case. I ran none of them; I did not run `npm run mutate` either.
- Docs: `docs/deploy.md` ("Another machine for jobs") and the refusal list in `packages/core/docs/commands/spawn.md` both give the refusal's message.
- The core's line budget goes from 7116 to 7126, which you decided (AR-D453). `job-machine.ts` (172 lines) and `git.ts` (63 lines) stay green.
- The worker's final message matches the diff: the files, the commits and the test counts.

## Notes
- (risk) packages/machines/src/machine-place.ts:80: Automatic placement can choose another machine for a Git LFS project. A spawn that names no machine can be placed on another machine and then refused by the core instead of staying on `local`. The worker filed this as F1.
- (risk) packages/core/src/machine-sync.ts:88: A branch that becomes LFS on the machine leaves its objects there. A job whose base has no LFS but whose branch adds `filter=lfs` keeps its large files on the machine, so `github.push` of that branch is refused. The worker filed this as F2.
- (minor) packages/core/src/git.ts:38: The check passes when `git grep` errors. An exit status of 128 reads as "not LFS". Low risk, since `base` and `fetch` are commits that were already resolved.
- (minor) packages/core/src/git.ts:38: Only committed `.gitattributes` files are read. An LFS filter declared in `.git/info/attributes` or `core.attributesFile` is not detected. That matches the ticket's wording ("whose `.gitattributes` names").

## Checks
- `npm run check && npm test`, one bash call, timeout 1800 s: `tsc` clean. My filter on that run did not keep the summary, so I ran `npm test` again.
- `npm test`, second run: tests 1495, pass 1431, fail 0, cancelled 0, no `✖` lines. No timing test failed, so I did not run `limits.test.ts` alone. Seven files print as yellow, none of them changed by this branch.

PASS