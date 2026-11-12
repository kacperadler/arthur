# AR0693 - Review 4

- Job: 2026-11-12-review-acecaff1
- Branch: arthur/2026-11-11-worker-07795aec
- Commit reviewed: 3a332a3585f56266c87f39aef76f5ea8bc139082
- Verdict: PASS

## Final message

No findings block the merge. Review 3 failed this branch because nothing tested a project's own prompts folders. The new test at `packages/delivery/test/auto-merge.test.ts:263` now covers a project's own `prompts.rolesDir`, `prompts.criteriaDir` and `prompts.vision`, and the review-3 mutations I ran by hand are now caught.

The branch meets each Done means point of AR0693:
- **Named file merges:** a role, criteria or vision `*.md` named in backticks in main's `## Scope` before `Out:` merges. `auto-merge.ts:49-55` reads main's copy at `before`, never the branch's.
- **Unnamed file refused:** a held file the Scope does not name is refused, and the refusal names it.
- **Still held:** workflows, `package.json`, lockfiles and other held `*.md` are refused whatever the Scope names.
- **Tests:** they cover named and unnamed roles, a named workflow, a path only under `Out:`, an indented `Out:`, paths in comments, and the branch's own ticket.

Files and budget:
- **Files outside the ticket's Scope In:** `review-needed.md:27`, `spec/roadmap.md:739` and `test/structure.test.ts` are outside it. The worker's message explains each: two notes from earlier reviews and a budget raise.
- **Budget:** delivery's raise from 2267 to 2277 is allowed by the standing decision AR-D538.
- **Docs:** I found no other doc that still describes the old behaviour; the eval fixture refuses `roles/support.md`, which is still correct.

## Notes
- (risk) `packages/delivery/src/auto-merge.ts:56`: a named role symlink gets the exception. The exception checks only the path, its `.md` ending and the Scope, not the file mode. So a branch that turns a named `.agents/arthur/roles/worker.md` into a symlink (mode 120000) to a file outside the repository now merges with `--auto`, which held it before. [INFERENCE] I did not run this, and did not check whether the core follows a symlink when it loads a role. If it does, the target's content would reach every job's prompt.
- (minor) `packages/delivery/src/auto-merge.ts:54`: the Scope is read from the first ticket in `job.tickets` only. A second ticket's Scope names nothing, so this errs on the side of refusing.

## Checks (all on 3a332a35)
- **`npm run mutate`:** 25 mutants, 24 caught, 1 survived, 23 not run (`--max 25`). The survivor is `auto-merge.ts:43: hunk reverted to the base`. That hunk only moves existing globs into the `roles` and `vision` constants, so behaviour is the same and no test can catch it, as review 3 also found.
- **Hand mutations:** run with `node --import @arthur/core/testing --test packages/delivery/test/auto-merge.test.ts`, which gives pass 12, fail 0 unchanged. After each one I restored the file with `git checkout -- packages/delivery/src/auto-merge.ts`, and `git status` was clean at the end.
  - Configured `criteriaDir` ignored (`${CRITERIA_DIR}/**`): caught, pass 11, fail 1.
  - Configured `rolesDir` ignored in the exception: caught, pass 11, fail 1.
  - Configured vision ignored in the exception (`"spec/vision.md"`): caught, pass 11, fail 1.
  - `named.has(path) &&` removed: caught, pass 9, fail 3.
  - `\s*Out:` removed from where the Scope ends: caught, pass 11, fail 1.
  - Comment stripping removed: caught, pass 11, fail 1.
  - An unclosed comment no longer stripped (`(?:-->|$)` changed to `-->`): caught, pass 11, fail 1.
  - `-z` dropped, splitting the changed files on newlines: caught, pass 11, fail 1.
- **`npm run check`:** `tsc`, no errors.
- **`npm test`:** tests 1749, pass 1685, fail 0, cancelled 0, skipped 64. This matches the worker's reported counts.

PASS