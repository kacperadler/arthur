# AR0360 - Review 1

- Job: 2026-10-25-review-848c9299
- Branch: arthur/2026-10-25-worker-009bdb40
- Commit reviewed: 772b62c2fa6318aacd341c14ce3319644b9c0a02
- Verdict: PASS

## Final message

I found nothing that blocks the merge. The branch covers every Done means point in AR0360. I ran `npm ci`, `npm run check` and `npm test` myself and all three pass. The worker's claims match what I saw.

## Findings

None.

## Notes (non-blocking)

- **Bypasses:** these only matter once AR0329's sandbox stops the job writing the checks file itself; until then the job can simply write false lines, as the updated doc says. With `git status --porcelain --untracked-files=no`, read once when the call ends (as the ticket asks), the extension still records `clean` for tests that did not run on the tip:
  - **One call that runs and then changes the tree.** `npm test; git stash`, or check out an older tree, test, then check out HEAD again. This is the worker's F1, recorded as open in `findings.md`.
  - **Hidden tracked changes.** `git update-index --assume-unchanged` or `--skip-worktree` on an edited tracked file keeps it out of `status`.
  - **Untracked files.** A file the tests use but never committed passes in the worktree while the tip lacks it. The ticket chose `--untracked-files=no`, so this is by design.
  - **The job's own Git settings.** The extension's `git status` (`checks-extension.ts:23-24`) runs without the `core.fsmonitor=false` / `core.hooksPath` / `--no-replace-objects` guard that `review-needed` uses (AR0330, AR0384). A job could set an fsmonitor that makes status report clean. This gives no extra access, because the extension runs in the agent's own process.
- **Redundant guard:** in `checks-extension.ts:25`, the mutation that drops `head.status !== 0` survives. Outside Git, `status` fails too, so it is equivalent there. In a repository with no commit yet it would write `HEAD clean`, which `review-needed` never matches to a tip, so it does no harm.
- **Ignored lines:** `review-needed.ts:83` silently ignores old-format lines (fewer than 4 words), which then answer "the job recorded no checks". This is tested and documented.
- **Ticket wording:** the Goal says the record is "marked stale after any later change". The branch does this by matching commit and tree instead of writing `stale` lines, as the Done means asks; `stale` is gone everywhere: code, tests, docs, README.

## Checks I ran (in this worktree)

- **Install and type check:** `npm ci` added 22 packages; `npm run check` (`tsc`) reported no errors.
- **Full suite:** `npm test` gave tests 1121, pass 1063, fail 0, cancelled 0, exit 0. The 58 not counted as pass are presumably skipped; the summary I printed shows no skip line.
- **Mutations:** I ran each against `node --test test/checks.test.ts test/review-needed.test.ts` in `packages/delivery`, then restored each file with `git checkout`. Afterwards `git status --short` was empty. Every one made exactly one test fail except the redundant guard noted above:
  - extension always writes `clean`
  - `--untracked-files=all`
  - outside-Git guard removed
  - commit check removed from the line `review-needed` picks
  - tree check removed from it
  - word-count filter changed to 3 or 5
  - the not-the-tip / dirty-tree return removed
  - fallback to a script's latest line removed
  - the two reasons swapped
  - pass/fail ignored
  - commit and tree suffix kept in the listed results
  - `head.status` guard alone removed: fail 0 (equivalent mutant, see notes)
- **Style:** `wc -l` gives 60 lines for `checks-extension.ts` and 98 for `review-needed.ts`, both under 200. The full suite includes the structure test, which holds the line budget, and it passed. No new dependency, class or barrel file; only `node:child_process` is imported.

PASS