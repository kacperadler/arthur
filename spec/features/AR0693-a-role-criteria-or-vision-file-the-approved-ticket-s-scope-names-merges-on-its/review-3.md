# AR0693 - Review 3

- Job: 2026-11-12-review-12d840e6
- Branch: arthur/2026-11-11-worker-07795aec
- Commit reviewed: cf45708421cd62624159d8bb9c3b924c1e05efaa
- Verdict: FAIL

## Final message

The review fails. One new behaviour has no test: the exception for a project's configured `prompts.criteriaDir` and `prompts.rolesDir`. The checks pass and every other part of the ticket is met.

## Findings

1. **`packages/delivery/src/auto-merge.ts:49`: no test covers a project's own criteria or roles folder in the Scope exception.**
   - The branch adds `prompts.criteriaDir` to `Entry`, adds `CRITERIA_DIR`, and puts `${entry?.prompts?.criteriaDir ?? CRITERIA_DIR}/**` and the project's `rolesDir` into the globs that may be let through. `packages/delivery/docs/commands/merge.md:39` documents this: "or the project's `prompts.criteriaDir` (default `.agents/arthur/criteria`)".
   - The new test in `packages/delivery/test/auto-merge.test.ts:218` only uses the default folders. I ran `auto-merge.test.ts` against two hand mutations, and both survived with `pass 11, fail 0`:
     - `` `${entry?.prompts?.criteriaDir ?? CRITERIA_DIR}/**` `` changed to `` `${CRITERIA_DIR}/**` `` (the configured criteria folder ignored);
     - `const prompts = [...roles, …` changed to `["**/roles/**", `${ROLES_DIR}/**`, …` (the configured `rolesDir` ignored for the exception).
   - Why it matters: in a project whose criteria or roles live under a dot folder other than the default, a named file waits for the owner every time. This is the forced question AR-D622 and this ticket set out to remove, and no test would notice.
   - Fix: add a case to the new test with `set({ autoMerge: true, prompts: { rolesDir, criteriaDir } })` set to dot-folder paths that `**/roles/**` and `**/criteria/**` do not reach. A file named in the Scope merges; the same file not named is refused.

## Notes
- (minor) `packages/delivery/docs/commands/review-needed.md:27`: "the same list holds `arthur merge --auto`" no longer mentions AR0693's exception for role, criteria and vision files named in the Scope. Its examples (a dependency bump, a script change) are still true.
- (minor) `packages/delivery/src/auto-merge.ts:53`: an `Out:` written as `- Out:`, `**Out:**` or `### Out` does not end the Scope, so paths under it count as named. Autopilot reads it the same way (`line.trim() === "Out:"`), and no ticket on main uses these forms (`git grep` found 0).

## Checks (on cf457084)
- **`npm run mutate`:** 25 mutants, 24 caught, 1 survived (`auto-merge.ts:43: hunk reverted to the base`, the change that only moved existing globs into constants, so behaviour is the same), 23 not run (`--max 25`).
- **Hand mutations on `node --import @arthur/core/testing --test packages/delivery/test/auto-merge.test.ts`,** each restored with `git checkout -- packages/delivery/src/auto-merge.ts`:
  - `.endsWith(".md")` condition removed: caught (pass 10, fail 1).
  - `"**/criteria/**"` dropped from the exception: caught (pass 10, fail 1).
  - Ticket read from `${tip}` instead of `${before}`: caught (pass 10, fail 1).
  - Default `CRITERIA_DIR` replaced: caught (pass 10, fail 1).
  - Configured `criteriaDir` ignored: survived (pass 11, fail 0).
  - Configured `rolesDir` ignored in the exception: survived (pass 11, fail 0).
- **`npm run check`:** `tsc`, no errors.
- **`npm test`:** tests 1748, pass 1684, fail 0, cancelled 0, skipped 64.

FAIL