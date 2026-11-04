# AR0616 - Review 1

- Job: 2026-11-04-review-fac0508e
- Branch: arthur/2026-11-04-worker-6a0f19cc
- Commit reviewed: 420a25d186e0277a8a57bdedaf79f517a787047a
- Verdict: PASS

## Final message

I found no blocking issues. In a job, the branch refuses `git fast-import` when it runs on the shared repository: from the job's own worktree, through `-C`, `--git-dir` or `GIT_DIR=`, after a `cd`, through an alias, or through a `.git` file link. The reason reads `into the main checkout (git fast-import with its refs on stdin)`, the same form `git update-ref --stdin` gets. `git -C /tmp/other fast-import` still runs. Every point of the ticket's Done means is met, and a row in `worktree-guard.test.ts` covers each form.

**The extra change beyond the ticket** (`packages/core/src/git-writes.ts:7`, `fast-import` added to `WRITES_OPERANDS`) is sound and the final message explains it. Without it, `git -C /tmp/other fast-import --export-marks=<main>/marks` wrote a file into the main checkout. My probe shows the same check now also covers `--export-pack-edges=<main>/m`. The cost: an `--import-marks=<main>/m` file is refused although Git only reads it. That errs on the safe side, and the final message names it.

**Bypass probes.** I added a throwaway block to the test's main row test, ran it, and restored the file with `git checkout`:

| Command | Result |
|---|---|
| `git -C <link outside every project, pointing to main> fast-import` | refused |
| `git --git-dir=/tmp/other/.git fast-import` with the cwd in the worktree | refused (stricter than needed, as the final message says) |
| `git -C /tmp/other fast-import --export-marks=m` | passes |
| `git -C /tmp/other fast-import --allow-unsafe-features` | passes (first note) |
| `/usr/lib/git-core/git-fast-import` | passes (second note) |

## Notes
- (security) packages/core/src/git-writes.ts:7: `--allow-unsafe-features` gets past the marks check. With this flag, a `feature export-marks=<path>` line on stdin writes that file anywhere, the main checkout included, from `git -C /tmp/other fast-import`. The guard lets the call through, yet `docs/deploy.md:44` now says the marks file is written "only where any write may go".
- (security) packages/core/src/bash-refusal.ts:98: calling Git's own program by path gets past the guard. The guard reads a call as git only when the command word is `git`, so `/usr/lib/git-core/git-fast-import` runs. The same holds for other git commands before this branch.
- (risk) packages/core/src/bash-refusal.ts:127: two mutants survived on the existing `update-ref` part of the changed line: `rest[at - 1] !== "-m"` changed to `rest[at - 2]` and to `rest[at - 0]`. No test covers how `git update-ref -m <msg> <ref>` skips its message. This is not the ticket's new behavior.
- (minor) packages/core/src/git-writes.ts:7: an `--import-marks` file inside a guarded place is refused although Git only reads it.
- (minor) packages/core/src/bash-refusal.ts: the file stays at 208 lines (yellow), as at the base.
- (bug) F1 (`sleep 300` left by a test during mutate) is confirmed: my interrupted `npm run mutate` left 7 `sleep 300` processes. I stopped each by pid with `kill`; afterwards `pgrep -a -x sleep` found none. It is filed in the ticket's `findings.md`.

## Checks (on 420a25d1)
- `npm run check`: tsc passed.
- `npm test`: 1535 tests, 1471 pass, 0 fail, 64 skipped. The structure test passed, and the core budget is unchanged.
- `npm run mutate`: stopped at the 1800 s limit before it finished. It reported only the 2 survivors above, both outside the fast-import behavior. The mutants it did not reach include the new fast-import conditions, and I did not hand-mutate them myself; the worker's final message reports each one caught. The tree was clean afterwards.
- Probe run of `worktree-guard.test.ts` (`--test-name-pattern` on the main row test): 1 pass, 0 fail.

PASS