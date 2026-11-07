# AR0635 - Review 1

- Job: 2026-11-07-review-3e7fa131
- Branch: arthur/2026-11-07-worker-1945ce8c
- Commit reviewed: 34ece13b604a8b3269b1c315b27fd431a6fc27a9
- Verdict: PASS

## Final message

No blocking findings. The change does what AR0635 asks: before the `spec: <id> merged` commit, the merge runs the `commit-msg` script that HEAD's `package.json` declares. It runs on the staged paths and the message file, in the sandbox and on the PATH the checks on main use. If the check refuses, or a path changes while it runs, the paths stay staged and uncommitted, and the merge commit is still pushed. Every other git call of the merge still runs with hooks off: the `merge-command.ts:89` line is unchanged.

Arthur's own wiring works: `package.json` declares `"commit-msg": "node test/other-projects.ts"`.

Files outside the ticket's Scope In:
- **`package.json`**: the ticket's "for Arthur, `node test/other-projects.ts`" needs it.
- **`docs/setup.md` and the header comment of `test/other-projects.ts`**: they describe the new check.
- **`test/structure.test.ts`**: raises delivery's line budget from 2195 to 2215. The coordinator is putting this to the owner, so it does not count against the branch.

The old docs line about the merge committing with hooks off is updated in `merge.md` step 8. `roles/coordinator/after-merge.md` still matches: the coordinator's own commit of the paths left staged runs the hook. `merge-outcome.ts` is 135 lines and `merge-command.ts` is 194, both green.

## Notes
- (risk) packages/delivery/src/merge-outcome.ts:95: HEAD only decides whether the script runs; the copy it runs is the one on disk. `vetted` reads HEAD's `package.json` to decide whether a check is declared, but npm then runs the working tree's `package.json` and `test/other-projects.ts`. The checks on main can write the checkout, so a step that rewrites the script to `true` turns the check off. This guards against an outcome line naming a project by accident, not against a hostile step.
- (minor) packages/delivery/src/merge-outcome.ts:94: broken `package.json` throws. If HEAD's `package.json` is not valid JSON, `JSON.parse` throws inside `settleTicket` after the merge commit is made. The checks on main would almost certainly fail first. [INFERENCE]

## Checks (on 34ece13b)
Following your instruction, I did not run `npm test` or `npm run mutate`.
- **`npm run check`**: tsc passed with no errors.
- **The new test alone**: `node --import @arthur/core/testing --test --test-name-pattern="commit-msg script" packages/delivery/test/merge.test.ts` gave pass 1, fail 0.
- **Hand mutations of `merge-outcome.ts`**: I ran the same test on each, and each gave fail 1. I restored the file each time with `git checkout -- packages/delivery/src/merge-outcome.ts`, and `git status --short` was clean at the end. The mutations:
  - removed the call to `vetted`
  - disabled the refusal (`if (false) return`)
  - forced the check for a path changed during the run to pass
  - removed the `declared.status !== 0` guard
  - wrote an empty message file instead of the subject
  - ran the `git diff` for changed paths on a dummy path instead of the staged ones
- **Arthur's real script**: in a `mktemp -d` folder, I ran `npm run --silent commit-msg -- <file>`:
  - a clean `spec: AR0635 merged` message exited 0
  - a message naming a folder of `projects/` exited 1 (output suppressed, so no project name is shown)
- **Commit with paths during the check**: in a throwaway repo, a file created under a staged folder while the check runs is not in `git commit -- <folder>`; it stays untracked (`?? f/new`). So the changed-path check is not missing new files.

PASS