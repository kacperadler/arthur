# AR0693 - Review 5

- Job: 2026-11-12-review-3657f063
- Branch: arthur/2026-11-11-worker-07795aec
- Commit reviewed: c8e7ea56563dedd263b7cc84f2c7123373152153
- Verdict: PASS

## Final message

No finding blocks the merge. The branch does everything AR0693's Done means asks, and every check I ran passes on c8e7ea56.

**What it does against the ticket:**
- **Named file merges:** `autoRefusal` (`packages/delivery/src/auto-merge.ts:47-56`) lets through a role, criteria or vision `*.md` file. The ticket must name its exact path in backticks in the `## Scope` of main's ticket.md, read at `before`, before `Out:`. Comments are dropped first.
- **Everything else stays held:** CI workflows, `package.json`, lockfiles, other held `*.md` files and non-ASCII paths still refuse, whatever the Scope names. Both tests in `packages/delivery/test/auto-merge.test.ts` cover this.

**Since review 4's PASS on 3a332a35**, two things changed:
- **Merge of main:** the diff from `b629d52` touches only the 7 files the worker lists, so nothing of main was lost. Delivery's budget in `test/structure.test.ts` goes from main's 2318 to 2327. The worker's message measures and explains it, and the structure test passes.
- **c8e7ea56, test-only:** it pins the Scope heading's trailing blanks and that backticks pair within a line. I confirmed by hand that the four mutants the worker names are now caught.

**Docs:** `merge.md:39`, `review-needed.md:27` and roadmap entry 59 describe the exception. The eval fixture `roles/support.md` is still refused, which is still correct.

## Notes
- (minor) `packages/delivery/docs/commands/review-needed.md:39`: "once CI passed on its tip and no held path is in it" does not mention AR0693's exception. It does not mislead: a file the Scope names is no longer a held path for `--auto`.
- (minor) `packages/delivery/src/auto-merge.ts:53`: autopilot cuts a `:42` line suffix off a path in the Scope, but delivery does not. So `roles/x.md:3` names nothing here. That only refuses more, so it is safe.
- (minor) `packages/delivery/src/auto-merge.ts:56`: review 4 noted that a named role path turned into a symlink gets the exception. The core already refuses a symlinked override or criteria file ("a symlinked override or criteria file … is refused with its path and never read" passed in `npm test`). I did not check how a symlinked vision is read.

## Checks (all on c8e7ea56)
- **`npm run check`:** `tsc`, no errors.
- **`npm test`:** tests 1788, pass 1724, fail 0, cancelled 0, skipped 64. This matches the worker's counts. The structure test passes, and `auto-merge.ts` is not in its yellow list.
- **`npm run mutate`:** 48 mutants, 47 caught, 1 survived, none left unrun.
  - The survivor is `auto-merge.ts:43: hunk reverted to the base`. That hunk only moves the existing role and vision globs into constants, so it changes no behavior.
- **Mutations by hand,** each run with `node --import @arthur/core/testing --test packages/delivery/test/auto-merge.test.ts` (unmutated: pass 12). Each one was caught:

| Mutation | Result |
|---|---|
| `[ \t]*` changed to `[\t]*` | pass 11, fail 1 |
| `[ \t]*` changed to `[ ]*` | pass 11, fail 1 |
| `[ \t]*` removed | pass 11, fail 1 |
| `[^`\n]+` changed to `[^\n]+` | pass 11, fail 1 |
| `[^`\n]+` changed to `[^`]+` | pass 11, fail 1 |
| `\s*Out:` changed to `Out:` | pass 11, fail 1 |
| The Scope's end split removed | pass 0, fail 1 (the whole file) |
| The split ending only at `Out:` (`## ` removed) | pass 0, fail 1 (the whole file) |

  I restored the file with `git checkout --` after each one, and `git status --short` is empty.
- **`npx arthur merge --help`:** it does not run in a bare checkout (`unknown command merge`, no `arthur.config.ts`). I read the doc page it prints, `packages/delivery/docs/commands/merge.md`, instead.

PASS