# AR0384 - Review 1

- Job: 2026-10-25-review-ar0384-git-replac-9e34c262
- Branch: h/2026-10-25-ar0384-git-replace-ee20b11a
- Commit reviewed: e500d45647cc7d0e8e19c67639f156337b7e1d87
- Verdict: FAIL

## Final message

## Review: h/2026-10-25-ar0384-git-replace-ee20b11a @ e500d456

### Findings

**`spec/features/AR0384-.../ticket.md` — missing required Decision for the line-budget raise.** `test/structure.test.ts` raises the `core` package budget from 6066 to 6071 lines (`BUDGETS` constant), to accommodate the new `replaces` field/logic in `git-writes.ts`. The styleguide (Shape) is explicit: "the number [budget] lives in that test only, and a raise is a decision recorded in the ticket." `git diff fe5e28c..e500d45 -- spec/features/AR0384*/ticket.md` and `git log -p` on that path are both empty — the ticket's `## Decisions` section still has only the two pre-existing 2026-10-23 entries (Source, Coordinator approval); no entry records the budget raise. The task's own Focus line ("Check docs and any line-budget raise are recorded in the ticket") calls this out directly, and it fails: the raise is real, undocumented. This is the Shape-rule violation the review guide's FAIL list names generically ("The styleguide's Shape rules break").

### Notes (non-blocking)
- `findings.md` F1/F2 correctly scope out `fetch`/`push` into `refs/replace` and the other un-hardened `git -C` reads (plans.ts, commit-rules.ts, etc.) as `open` — consistent with the ticket's literal scope ("beside the `-c` flags of AR0330"), not a gap in this branch.
- The `replace`/`lists` detection in `gitCall` (git-writes.ts) is correct on inspection: bare `git replace`, `-l`, `--list`, abbreviations (`--li`), and bundled forms pass; `-d`, `--delete`, `--edit`, `--graft`, `--convert-graft-file`, and any non-list form (including through a `-c alias.r=replace` alias and across `--`) are refused. Verified by mutation (below).

### Checks run
- `npm ci` — clean.
- `npm run check` — clean (`tsc`, no errors).
- `npm test` — **1092/1092 pass**, matches worker's claimed result.
- Mutation: removed `|| replaces` from the refusal condition in `worktree-guard.ts`'s `git()` closure, ran `node --test packages/core/test/worktree-guard.test.ts` → 1 failing test (`git replace main HEAD` no longer refused), confirming the new rows actually exercise the fix. Restored the file (`cp /tmp/wg.bak …`, confirmed no diff left).
- Manually traced the `lists` regex against every new test row (`-l`, `-d`, `--delete`, `--edit`, `--graft`, `--convert-graft-file`, `main -- -l`, `- main`, alias case) — all match the expected MAIN/pass outcome.

The security fix itself is sound and well tested end to end (worktree-guard, job-records prune, machine prune, auto-merge, merge/review-needed, github push all get coverage for reading past a replacement). The sole blocker is the undocumented line-budget raise the styleguide requires to be recorded as a ticket Decision, which this branch does not do.

FAIL
