# AR0738 - Review 1

- Job: 2026-11-24-review-aa62214e
- Branch: arthur/2026-11-24-worker-963de939
- Commit reviewed: 78e40ab9e29e47f7772ac9b0bbc0680bba65f0af
- Verdict: FAIL

## Final message

I'm failing this branch. `arthur commit-board` commits files that are not board files whenever a folder is named like a board file, which breaks the ticket's first Done-means point.

## Findings

1. **`packages/delivery/src/commit-board.ts:19-23` and `:61`: a folder named like a board file gets all of its contents committed.** `spec/build.json`, `spec/decisions.jsonl`, `spec/schedule.json` and `CHANGELOG.md` are plain pathspecs. In Git, a plain pathspec also matches a folder of that name and every file below it. So `git status ... -- ...paths` (line 61) lists those files, and `update-index` and `git commit -- ...changed` commit them.
   - **Proof:** I ran a throwaway test on this tip. It loaded delivery on the fake host and left `spec/schedule.json/evil_spec.rb` and `CHANGELOG.md/src/code.ts` in the checkout. `arthur commit-board 'Board'` printed `committed Board: f9f68fb, 2 files`, and `git show --name-status HEAD` listed `A CHANGELOG.md/src/code.ts` and `A spec/schedule.json/evil_spec.rb`.
   - **What it breaks:**
     - The ticket's Done-means point "Only board paths are committed".
     - The plan's T2 promise that "anything else the coordinator leaves in `spec/` is never committed by it". The plan names an RSpec file left in `spec/` as the risk this limit covers, and `spec/schedule.json/x_spec.rb` is exactly such a file.
     - The doc's claim "and nothing else", in `packages/delivery/docs/commands/commit-board.md:9-16`.
   - **Scope:** most projects have no `spec/schedule.json` or `spec/decisions.jsonl`, so a coordinator sandboxed to `spec/` can make one as a folder.
   - **Not affected:** the `:(glob)…/*.md` and `.html` pathspecs. `git status` with them did not list `spec/features/a/x.md/evil.rb` or `spec/quality/r.md/evil.rb` (git 2.43.0).
   - **No test covers it.**
   - **Possible fix:** keep only status entries that equal a plain path, or that a glob pathspec matches. Add a test row with such a folder.

## Notes
- (risk) `packages/delivery/src/merge-outcome.ts:94-97` via `commit-board.ts:76`: `vetted` decides whether a check exists from `HEAD:package.json`, but `npm run commit-msg` runs the script in the working tree's `package.json`. In `arthur merge` the working tree equals HEAD. In `arthur commit-board` it need not: an uncommitted change to `"commit-msg"` (for example `"true"`) replaces the check, so `commit-board.md` step 4 ("the package.json HEAD holds") misleads. [INFERENCE: from npm's documented behaviour; not run.]
- (risk) `packages/delivery/src/commit-board.ts:65`: only symlinks are refused. A hard link under `spec/features/*.md` to a file outside the checkout would be committed with that file's contents. [INFERENCE: whether T5's Landlock sandbox allows such a link was not tried.]
- (minor) `packages/delivery/src/commit-board.ts:76-82`:
  - `git commit -- <paths>` commits the working-tree contents. A board file the coordinator staged with other contents gets its working-tree version committed.
  - On a refusal, the reset also unstages board files the coordinator had staged before the command. The doc says so, but "other staged files stay as they were" is not true for these.
- (minor) `packages/delivery/src/commit-board.ts:59`: the two mutants that survive change nothing in practice. `checkConfig`'s pins already include `-c core.useReplaceRefs=false`, and `core.fsmonitor=true` still overrides the repository's program. This matches the worker's account.

## Checks run (tip `78e40ab9`)
- `npm run check`: tsc clean.
- `npm test`: exit 0; 1946 tests, 1882 pass, 0 fail, 64 skipped.
- `npm run mutate`: `100 mutants, 98 caught, 2 survived; 18 not run (--max 100)`. Both survivors are on `commit-board.ts:59` (`--no-replace-objects` removed, `core.fsmonitor=false` turned into `true`).
- Hand mutations, each restored with `git checkout`; each was caught:

| Mutation | Tests that failed |
|---|---|
| `git reset` in the catch removed | 4 of `commit-board.test.ts` |
| `links.length > 0` turned into `> 1` | the symlink test |
| the refusal of a subject starting with `-` removed | the usage test |
| `init.ts` `return 1` on refusal turned into `return` | `init.test.ts` and `test/init-commit.test.ts` |

- My first two hand mutations ran at the same time on the same file, so their results are discarded. Both were run again one at a time; those runs are the rows above.
- Throwaway end-to-end test of the folder case (finding 1): the commit held both files that are not board files. The test file was removed afterwards, and `git status` was clean.
- `git status --porcelain` with `:(glob)` pathspecs on `.md`-named folders: no entries listed.

FAIL