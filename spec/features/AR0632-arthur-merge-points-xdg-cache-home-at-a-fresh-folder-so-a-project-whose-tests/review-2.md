# AR0632 - Review 2

- Job: 2026-11-09-review-f6c2cf6d
- Branch: arthur/2026-11-09-worker-544a2960
- Commit reviewed: d527df2f3fec246d731cc7446547c32ce9dffeb0
- Verdict: PASS

## Final message

No blocking findings. The merge of main kept both sides, and at d527df2f the branch still meets every point of the ticket's Done means.

- **Conflict resolution:** I compared the branch with the base dba4513e word by word (`git diff --word-diff=plain`). Only this ticket's words changed:
  - `packages/core/src/job-sandbox.ts:168-171`: `stepSandbox` still hides `[arthur.envFile, ...unread()]`, as main has it. The only code change is the `PLAYWRIGHT_BROWSERS_PATH` prefix at `:170-171`. The comment's lines were rewrapped and end with the AR0632 sentence; every changed line is 158 characters or fewer.
  - `packages/delivery/docs/commands/merge.md:60` and `docs/plugin-api.md:47`: each gains only the AR0632 sentence, and the merge doc's sentence sits right after the caches sentences.
- **Done means:**
  - On Linux each step gets `PLAYWRIGHT_BROWSERS_PATH`, pointing at `$XDG_CACHE_HOME/ms-playwright` (or `~/.cache/ms-playwright` when that is empty or unset). It is left out when Arthur's environment already sets a non-empty one.
  - The browsers folder is not among the paths a step may write, so it stays read-only.
  - The fake `playwright` tests cover all six cases, and the real-sandbox test checks that both writes into the browsers folder are refused.
  - Limiting the variable to Linux was explained by the worker and accepted in review-1, which still holds.
- **Budget and size:** the core budget is 7445, base 7444 plus one line (AR-D538). `job-sandbox.ts` is 215 lines, yellow; it was already yellow before this branch (209 lines in review-1). The final message says why, and the structure test passes.
- **The worker's claims match my runs:** the test counts, the mutate counts, the 215 lines, the 6-file diff and a clean tree all agree.

## Notes
- (minor) packages/core/src/job-sandbox.ts:170-171: the browsers path is read once, when `stepSandbox` is called. The check for an existing `PLAYWRIGHT_BROWSERS_PATH` is made again for each command. Nothing changes the environment between those two moments in a merge, so the timing difference does no harm.

## Checks (all on d527df2f)
- **Type check:** `npm run check` printed 0 `error TS` lines.
- **Full suite:** `npm test` gave 1670 tests: 1606 pass, 0 fail, 0 cancelled, 64 skipped. The structure test printed `packages/core/src/job-sandbox.ts: 215 lines, yellow (over 200)` and passed.
- **The two AR0632 tests alone:** `node --import @arthur/core/testing --test --test-name-pattern=AR0632 packages/core/test/sandbox.test.ts` gave 2 pass, 0 fail, 0 skipped. The real-sandbox test ran here; it was not skipped.
- **Mutations:** `npm run mutate` gave 10 mutants, 10 caught, 0 survived.
- **Hand mutations:** each was run against the AR0632 tests and restored with `git checkout -- packages/core/src/job-sandbox.ts`. `git status --short` printed 0 lines afterwards.
  - Making the browsers folder writable gave 0 pass, 2 fail. The step's output read "the browser written / a new browser written" instead of "refused", so the mutation was caught.
  - Dropping the `!process.env.PLAYWRIGHT_BROWSERS_PATH` condition gave 0 pass, 2 fail, so it was caught.
- **Leftovers:** after the runs, `pgrep -af fake-agent.ts` found no fake agent still running.

PASS