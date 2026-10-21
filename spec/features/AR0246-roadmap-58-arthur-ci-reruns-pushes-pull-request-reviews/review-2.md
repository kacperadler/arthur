# AR0246 - Review 2

- Job: 2026-10-21-review-ar0246-roadmap-58-2100806a
- Branch: h/2026-10-21-ar0246-roadmap-58-github-56fccda8
- Commit reviewed: 1cc473385dc0b9f7e6cd219c00d7a8324c177a7f
- Verdict: PASS

## Final message

Proper two-parent merge (914be99 branch tip, 7083a4d main), signed off. No rebase, as instructed.

All verification complete.

**Findings:** none.

**Notes:**
- Auto-generated `CHANGELOG.md` and `spec/build.json` changes are from merging main's already-landed AR0241/AR0243/AR0245 commits, not new work by this merge — expected and out of scope.

**Checks run (in this worktree, on the merge commit):**
- `git log`/`git show` on `1cc4733`: confirmed a genuine two-parent merge (914be99 branch tip, 7083a4d main), signed off, no rebase.
- `docs/plugin-api.md`: "Changes since entry 51" has both AR0241 (`projects.install`) and AR0246 (`github.push`) entries; "Provided names" table has both `projects.install` and `github.push` rows, no duplication.
- `packages/delivery/test/merge.test.ts` diff: kept both sides' tests; added `installs`/`installAs` fixture plumbing for `projects.install`; the `merge.check` test now asserts `bun install --frozen-lockfile: passed.` appears (from AR0241's merge) and that `github.push` still pushes main (`pushes === [{project:"acme", branch:"main"}]`) after the merge — exercises push-after-merge together with the `projects.install` step.
- `test/structure.test.ts`: budgets are `delivery: 779, github: 586, projects: 486, manage: 368`; verified by `cat packages/<p>/src/*.ts | wc -l` for all four — exact match. Comment trail keeps AR0241, AR0245, AR0246 merge notes in order.
- `npm ci`: clean, no output/errors.
- `npm run check`: passes, no tsc errors.
- `npm test`: 868/868 passed, 0 failed — matches worker's claim exactly.
- Mutation test: changed `project: job.project` → `project: "wrong"` in `merge-command.ts`'s `projects.install` call; re-ran `packages/delivery/test/merge.test.ts` — two tests failed on the mismatched `project` field (the install-provenance assertions), confirming the merged test actually asserts the install request shape and would catch a regression. Reverted with `git checkout -- packages/delivery/src/merge-command.ts`; `git status --short` clean afterward.

PASS
