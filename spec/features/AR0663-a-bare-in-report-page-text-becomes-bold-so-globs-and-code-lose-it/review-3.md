# AR0663 - Review 3

- Job: 2026-11-09-review-c28a0a5c
- Branch: arthur/2026-11-09-worker-e677416d
- Commit reviewed: 8701a9ad5bdddf6c484d29050841da535cc586eb
- Verdict: FAIL

## Final message

I'm failing this review. Two parts of the new behaviour can be changed by a mutation without any test failing: the bold rule's inner-side checks, and the three-tilde fence limit. Review criteria count each uncaught mutation of a key behaviour as a FAIL.

## Findings

1. **`packages/manage/src/report-file.ts:83`: removing `/` or `*` from the opening mark's inner check breaks no test.** The full `npm run mutate -- --max 100` run, which goes past the `--max 25` gate, reports these as survivors:
   - `(?=[^\s/*])` → `(?=[^\s*])`. I applied it by hand: `see **/tmp** now` turns into `see <strong>/tmp</strong> now`. Unchanged, the tip keeps it as typed.
   - `(?=[^\s/*])` → `(?=[^\s/])`. With this change `***x** now` makes `*x` bold. The tip keeps it as typed, as I rendered and saw.

   The code comment at lines 79–82 and `docs/manage.md:115` both say neither mark touches a space, `/` or `*` on its inner side. The opening half of that rule is untested. Every `/` case in the test is also refused by another condition, either the closing lookbehind or the opening lookbehind, so the rows never test the opening check itself.

2. **`packages/manage/src/report-file.ts:107`: moving the tilde limit by one breaks no test.** The survivor is `~{3,}` → `~{4,}`. I applied it by hand to the quote `> ~~~` / `> **x**` / `> ~~~`. It then renders `~~~\n<strong>x</strong>\n~~~`: the fence lines show and the body is formatted. The tip renders `**x**`. The tests only open tilde fences with `~~~~`, so a three-tilde fence is never tested. That is the most common tilde fence, and line 139 of the doc promises it. The worker's message says `~{3,}`→`~{2,}` is now caught, which is true, but the limit in the other direction is not.

3. **`packages/manage/src/report-file.ts:83`: the code-span part of a bold span's content (`\x60[^\x60]+\x60`) is barely tested.** Three mutants survive: `[^\x60]` → `[^60]`, `[^\x0]` and `[^\x6]`. The only row with a code span inside bold is `` `2 ** 3` ``, which contains no `0` or `6`. So a change that drops the bold whenever its code span holds one of those characters passes. A row with a code span that holds a `0` or `6` inside bold would catch all three.

## Notes
- (bug) `packages/manage/src/report-file.ts:83`: a bare `**` between two code spans can sit inside a bold span. The `.` path takes a backtick on its own, so the backticks pair up wrongly. On the tip, ``**a `x` b ** c `y`** d`` renders `<strong>a <code>x</code> b ** c <code>y</code></strong> d`. That breaks the rule stated at line 82 and in `docs/manage.md:115`: "a bold span holds no `**` outside its code spans".
- (minor) `packages/manage/src/report-file.ts:83`: the mutant that drops `*` from the closing lookbehind `(?<=[^\s/*])` is equivalent. The content rule `(?!\*\*).` already stops the content's last character being a `*` right before `**`, so no test can catch it. That `*` could be dropped.
- (minor) `packages/telegram/test/telegram.test.ts:303`: "Telegram unreachable: the slices wait in the outbox…" failed in my second full `npm test` run and passed when run alone. The branch doesn't touch that file.

## Checks (all on `8701a9ad`)
- `npm run check`: tsc clean.
- `npm test`:
  - First run: no failure seen, but my filter dropped the summary lines, so I have no counts from it.
  - Second run: 1671 tests, 1606 passed, 1 failed, 64 skipped. The failure was the Telegram test above.
  - That file alone, `node --import @arthur/core/testing --test packages/telegram/test/telegram.test.ts`: 22 tests, 22 passed, 0 failed. It doesn't count against the branch.
- `npm run mutate` (the default `--max 25`): 25 mutants, 25 caught, 0 survived, 46 not run. This matches the worker's claim.
- `npm run mutate -- --max 100`: 71 mutants, 64 caught, 7 survived. These are the six in findings 1–3 plus the equivalent `(?<=[^\s/])` one in the notes.
- Hand mutations with `sed` (`~{4,}`, and `(?=[^\s*])`), rendered through `reportPage`: output as quoted in findings 1 and 2. Restored with `git checkout --`; `git status --short` was empty afterwards.
- The new test with the base `cec635c8` copy of `report-file.ts`: 1 test, 0 passed, 1 failed. So the test fails before the change, as the ticket asks. Restored the same way.
- `docs/manage.md` and the `reportPage` comment: searched for "fence" and "bold"; no stale mention left. There is no `findings.md` for this ticket on the branch.

FAIL