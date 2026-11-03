# AR0611 - Review 1

- Job: 2026-11-04-review-7d5b96b0
- Branch: arthur/2026-11-04-worker-d76d4324
- Commit reviewed: b9c34facbeb2a5f31eac205d72a0670ac31faef1
- Verdict: PASS

## Final message

No blocking findings. The branch adds the `### Deferred findings` section to the audit's prompt and covers every Done means point of AR0611.

- **Section and format:** `packages/manage/src/audit.ts:82` lists each entry whose status is `deferred (client summary)` as `- <id> F<n> (<kind>): <title>. Where: <where>`. It prints `none` when there is none. The status text matches what `packages/findings/src/on-merge.ts:31` writes in `summary` mode.
- **Window:** the section uses the same window as `### Stats`. `stats.ts` now exports `mergedSince`, and both `stats()` and the new section call it, so the two windows can't drift apart. With no earlier audit, every merged ticket counts.
- **Tests** (`packages/manage/test/audit.test.ts`):
  - The first audit shows the deferred entries of AC0002, merged before the window, and of AC0003, merged after.
  - The second audit shows only AC0003's. That catches the window being ignored.
  - A deferred entry on a ticket not merged never shows, and neither does an entry with `ticket AC0009` as its status.
  - An entry with no Kind or Where still prints.
  - The test asserts `none` for an empty result.
  - Removing the section fails all of these.
- **Docs:** `packages/manage/docs/manage.md:65` and `packages/manage/roles/auditor.md:9-11` describe the section.
- **Open findings:** the section's output is unchanged; it now uses the same reader, with `open` as the status and no kind shown.
- **Line budget:** manage's budget goes from 1327 to 1332 (`test/structure.test.ts:34`). The worker's message states the raise and why. `audit.ts` is 93 lines and `stats.ts` is 103, both green.
- **Scope:** the only file outside the ticket's Scope is `stats.ts`, for the shared window, which the worker's message explains.

## Notes
- (minor) `packages/manage/src/audit.ts:81`: mutate survivor, `|| "none"` removed from `### Open findings`. That section's behavior is unchanged from the base, and no test asserts its `none` case. The same fallback in the new deferred section is tested.
- (minor) `packages/manage/src/audit.ts:61`: mutate survivor, the `number === undefined` guard removed. That condition was already in the base. None of the test fixtures has a status line before the first `## ` heading, so nothing catches its removal.
- (minor) `packages/manage/src/stats.ts:76`: mutate survivor, the hunk reverted to the base. This mutant is equivalent: putting the filter back inline behaves the same.
- (minor) `spec/roadmap.md:743`: entry 62's "Delivers" line still says "stats and open findings". It is a historical list of what that entry delivered, still true, and the ticket's Scope doesn't name the roadmap.

## Checks
- `npm run check && npm test` in one call with an 1800 s timeout: tsc passed and the tests ran. My output filter matched nothing on that run, so I reran `npm test` alone: 1502 tests, 1438 pass, 0 fail, 0 cancelled, 64 skipped. This matches the worker's numbers. No timing test failed, so I didn't need to run `limits.test.ts` alone.
- `npm run mutate`: 25 mutants, 22 caught, 3 survived, 13 not run (`--max 25`). The three survivors are the notes above; none is a key behavior of this ticket.
- I read the whole diff by hand. No file in it shows as binary.

PASS