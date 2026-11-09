# AR0632 - Review 1

- Job: 2026-11-09-review-dde49ee4
- Branch: arthur/2026-11-09-worker-544a2960
- Commit reviewed: f7d5b8b24b1241ebd77568049e05566f8176f94e
- Verdict: PASS

## Final message

No blocking findings. The branch meets every point of the ticket's Done means:

- **Linux merge steps get the variable:** `stepSandbox` (`packages/core/src/job-sandbox.ts:165-166`) gives each step `PLAYWRIGHT_BROWSERS_PATH`. It points at `$XDG_CACHE_HOME/ms-playwright` from Arthur's own environment, or `~/.cache/ms-playwright` when that variable is unset or empty. It is left out when Arthur's environment already sets a non-empty one, and then the step inherits that value.
- **The folder stays read-only:** it is not added to the paths the sandbox lets a step write. In the real sandbox, a write to the browser and a new `chromium-2` folder are both refused, while the step's own cache is still written.
- **Linux only:** the ticket does not ask for this limit. The worker's final message explains it: on macOS Playwright looks in `~/Library/Caches`, which the step's `XDG_CACHE_HOME` does not move, so setting the variable there would point at the wrong folder. The darwin test case covers this.
- **The tests fail before the change:** with line 166 put back to `start(cached(cache, command))`, the two AR0632 tests give 0 pass, 2 fail.
- **Docs:** the new sentence in `packages/delivery/docs/commands/merge.md` sits right after the caches sentences, and `arthur merge --help` prints it. `docs/plugin-api.md` mentions the variable in the `sandbox(folder, cache, note)` row. No other doc lists a merge step's variables in a way the change makes wrong: `spawn.md:133` covers the job's install, which this change leaves alone, and `deploy.md:41` only says the caches are separate.
- **Budget and file size:** the core budget goes from 7438 to 7439. AR-D538 lets any package budget rise by what its ticket needs, without asking the owner; the structure test passes with the new number. `job-sandbox.ts` is 209 lines: it was already yellow and stays yellow, which the final message says.
- **The worker's claims reproduce:** the test counts, the mutation result, the line count and the help text all match what I saw.

## Notes
- (risk) packages/core/src/job-sandbox.ts:166: a `playwright install` inside a merge step may now fail. A project whose `pretest` or `test` script runs it, which used to download into the fresh merge cache, now meets a read-only folder. As far as I know, Playwright's installer writes a lock file and a `.links` entry in its browsers folder even when the browser is already there [INFERENCE from Playwright's registry code; not run]. The ticket asks for this read-only folder, so the merge doc could tell users to install browsers outside the merge.
- (minor) packages/core/src/job-sandbox.ts:165: a relative `XDG_CACHE_HOME` is resolved against Arthur's working folder, not the step's. The XDG spec does not allow relative values anyway.
- (minor) packages/core/test/sandbox.test.ts:241: the bare-step test passes the real `/tmp` as the checkout folder. `checkout()` only reads it (git rev-parse and the entries at its top) and writes nothing, but a folder of the test's own would keep it clear of the fixed-`/tmp` rule.
- (minor) findings.md F1 (a fake agent a test run left running): it did not happen on my runs. `pgrep -af fake-agent.ts` found nothing after the full suite and mutate.

## Checks (all on f7d5b8b2)
- **Type check:** `npm run check` printed 0 `error TS` lines.
- **Full suite:** `npm test` gave 1649 tests, 1585 pass, 0 fail, 0 cancelled, 64 skipped. The structure test printed `packages/core/src/job-sandbox.ts: 209 lines, yellow (over 200)` and passed.
- **The ticket's tests alone:** `node --import @arthur/core/testing --test --test-name-pattern=AR0632 packages/core/test/sandbox.test.ts` gave 2 pass, 0 fail, 0 skipped, so the real-sandbox test ran here and was not skipped.
- **Mutations:** `npm run mutate` gave 10 mutants, 10 caught, 0 survived.
- **Hand mutations**, each run with the AR0632 tests and restored with `git checkout`:

| Mutation | Result |
|---|---|
| Browsers folder added to the writable paths | 1 pass, 1 fail (the browser and the new browser written instead of refused): caught |
| `!PLAYWRIGHT_BROWSERS_PATH` → `=== undefined` | 1 pass, 1 fail: caught |
| `\|\|` → `??` on `XDG_CACHE_HOME` | 1 pass, 1 fail: caught |
| `process.platform === "linux"` removed | 1 pass, 1 fail: caught |
| Condition forced to `true` | 1 pass, 1 fail: caught |
| Fix removed (the fails-before check above) | 0 pass, 2 fail |

- **Help text:** `npx arthur merge --help`, with a throwaway `arthur.config.ts` (orchestration and delivery, home in a temporary folder, removed afterwards), printed the new `PLAYWRIGHT_BROWSERS_PATH` sentence. `git status` was clean afterwards.

PASS