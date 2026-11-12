# AR0693 - Review 1

- Job: 2026-11-11-review-7747a3c1
- Branch: arthur/2026-11-11-worker-07795aec
- Commit reviewed: 02c12b2d07be665257e2d6754c0e2e17e4f57cdb
- Verdict: FAIL

## Final message

## Findings

1. **`packages/delivery/src/auto-merge.ts:56`: the tests never check that a named held `*.md` file outside a role folder, a criteria folder or the vision is still refused.** I ran a mutation that drops `&& prompts.some((glob) => matchesGlob(path, glob))` from the skip condition. `packages/delivery/test/auto-merge.test.ts` still passed: tests 11, pass 11, fail 0. With that mutation, any `.md` file on the always-review list that a Scope names merges by itself. Examples are `.agents/**` files other than roles and criteria, or a project's own `alwaysReview` entry such as `SECURITY.md`.
   - Done means says: "CI workflows, `package.json`, lockfiles and every other always-review path still refuse `--auto` whatever the Scope names". The worker's message also lists this among what stays held.
   - The new test's refusal cases are all non-`.md` (cases 3 to 6) or paths the Scope does not name (cases 2 and 7 to 9). The `.md` check alone refuses every one of them, so the glob restriction has no test. The review criteria count an uncaught removed condition of a key behavior as a FAIL.
   - Fix: add a case where main's Scope names a held `.md` file outside role, criteria and vision paths, e.g. `.agents/skills/deploy.md`, and the merge is refused with `(the always-review list)`.

## Notes
- (risk) `packages/delivery/src/auto-merge.ts:52`: **The Scope is read from main at merge time, not at approval.** `spec/features/*/ticket.md` is not on the always-review list. So an earlier auto-merged branch, or the coordinator writing the board, can add a role path to a ticket's Scope after the owner approved it. The next job on that ticket then merges the role change without the owner. The ticket's status is also not checked.
- (minor) `packages/delivery/src/auto-merge.ts:50`: **Only the first ticket is read.** Only the first feature folder in `job.tickets` is read, so for a job with several tickets, a Scope in any later ticket is ignored.
- (minor) `packages/delivery/test/auto-merge.test.ts:218`: **The refusal cases passed before the change.** Done means asks that each test fails before the change. The three refusal cases (unnamed role file, named workflow, path named only under `Out:`) already passed then, as the worker's message says. Only the test as a whole fails before the change.
- (minor) `packages/delivery/src/auto-merge.ts:54`: **Possible bypass for non-ASCII paths (code outside this range).** `git diff --name-only` runs without `-c core.quotePath=false`. A non-ASCII path such as `.github/workflows/ż.yml` would then come out quoted and miss its glob. [INFERENCE] I did not run this.

## Checks (all on 02c12b2d, clean tree after restoring every mutation)
- **`npm run mutate`:** 25 mutants, 24 caught, 1 survived, 20 not run (--max 25), none not run for time. The survivor is `auto-merge.ts:43: hunk reverted to the base`. That hunk only moves the role globs and vision path into the `roles` and `vision` constants, so reverting it changes no behavior and no test can catch it, as the worker says.
- **Mutations by hand,** each run against `packages/delivery/test/auto-merge.test.ts`:
  - Remove the `prompts.some(...)` condition: 11 pass, 0 fail. **Survived** (finding 1).
  - Remove `?.split(/^Out:/m)[0]`: 10 pass, 1 fail. Caught.
  - Read the ticket at `${tip}` instead of `${before}`: 10 pass, 1 fail. Caught.
  - Each was restored with `git checkout -- packages/delivery/src/auto-merge.ts`; `git status --short` is empty.
- **`npm run check`:** `tsc`, no errors.
- **`npm test`:** tests 1748, pass 1684, fail 0, skipped 64. This matches the worker's counts.
- **F1:** `eca9687c` is main's merge of AR0692 and is an ancestor of the tip, so F1's "fixed in eca9687c" holds.
- **Docs:** `merge.md:39` and roadmap entry 59 describe the new exception. A search for `held path` and `merges no held` found no other stale line. The `review-pass-hook` eval still holds, because its ticket names no role.

FAIL