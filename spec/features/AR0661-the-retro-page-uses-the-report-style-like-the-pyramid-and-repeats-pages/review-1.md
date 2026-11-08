# AR0661 - Review 1

- Job: 2026-11-08-review-428926fc
- Branch: arthur/2026-11-08-worker-761965df
- Commit reviewed: 85ed8ca6cb3c6ec2201ee1d3a4ce36c33edef502
- Verdict: PASS

## Final message

No findings block the merge. The branch does what AR0661 asks, end to end:
- `RETROS.page` is now `reportPage` (`retro-due.ts:11`), and the plain `page()` is deleted. Nothing else used it; a search for `page` imported from `report-file` finds no other caller.
- `reportPage` (`report-file.ts:77-115`) now shows `**bold**` as `<strong>`, a backticked span inside bold as `<code>`, and an indented `- ` line as `<li class="sub">`. The retro header (`# Retro`, `- Job:`, `- Merges up to:`) goes in the black header, and everything from `## Period` goes in `main`.
- `report.md:3` no longer exempts the retro page, and `manage.md:115` describes the page in the report style. No doc still describes the plain page: searches for "plain page", "wrapped to the screen", "sets no colours" and "backticked" found nothing out of date.
- `spec/retro/2026-11-06.html` is exactly `reportPage(readFileSync("spec/retro/2026-11-06.md"))`. It contains no raw `**`, no `<p>-`, 24 `li.sub` items and 9 `<strong>`. The `.md` itself is unchanged.
- The new test in `retro.test.ts` checks the report-style header, a list item, a nested item, `<strong>`, `<code>`, `**` kept as typed inside a code span, and no raw `**` or bullet. With the base's `packages/manage/src` put back, `retro.test.ts` gives 9 pass, 2 fail, as the worker said.
- Every claim in the worker's message that I checked held up. Mutate survivors are as reported: one re-adds the deleted, unused `page()`, and three change CSS spacing values that were on that line before the change. None of them touches a key behaviour.
- Finding F1 in `findings.md` (quoted code in a Before/After column) matches what screenshot 3 shows.

## Notes
- (bug) packages/manage/src/report-file.ts:80: a bare `**` outside a code span becomes bold. `files under src/**/*.ts and test/**/*.ts` renders as `src/<strong>/*.ts and test/</strong>/*.ts`. Inside a Before/After quote, `const n = 2 ** 3 ** 2;` renders as `2 <strong> 3 </strong> 2`. Globs in a retro's prose or code in a pyramid column will lose their `**` this way. This is the same kind of problem as F1.
- (minor) packages/manage/src/report-file.ts:63: the CSS values `padding:0` in `main` and `margin:.3em 0` in `li` are not held by any test. Mutate only reaches them because `li.sub` was added to the same line.

## Checks (all on 85ed8ca6, in this checkout)
- **Type check:** `npm run check` (tsc) passed with no errors.
- **Full suite:** `npm test` gave 1648 tests, 1584 pass, 0 fail, 0 cancelled, 64 skipped.
- **Mutate:** `npm run mutate` ran 25 mutants, 10 not run (`--max 25`): 21 caught, 4 survived, all in `report-file.ts`:
  - line 56, "hunk reverted to the base": re-adds the deleted `page()`.
  - line 63, `padding:0` → `1`.
  - line 63, `padding:0` → `-1`.
  - line 63, `li{margin:.3em 0}` → `.3em 1`.
- **Hand mutations,** each restored with `git checkout -- packages/manage/src/report-file.ts` (run against `retro.test.ts`, `pyramid.test.ts` and `repeats.test.ts` unless noted):
  - Code inside bold left as typed: 26 pass, 1 fail (caught).
  - `red` class dropped from list items: 26 pass, 1 fail (caught).
  - `sub` class never set (`retro.test.ts` only): 10 pass, 1 fail (caught).
  - My first two hand mutations ran at the same time on the same file, so their results were thrown away and both were run again one at a time.
- **New test against the old code:** with the base's `packages/manage/src` put back, `node --import @arthur/core/testing --test packages/manage/test/retro.test.ts` gave 9 pass, 2 fail. After restoring the branch's code, `git status` was clean.
- **Regenerated page:** `reportPage` of `spec/retro/2026-11-06.md` equals the committed `.html` byte for byte (`true`, 20728 characters).
- **Page check:** the command from `report.md`, run exactly as written, printed `ok: spec/retro/2026-11-06.html at 420 px: 217 texts at 4.5:1 or more against their declared background, nothing scrolls sideways`.
  - Screenshots 1 and 3 looked at. Header, bold, nested lists and code chips are readable. The fence and backtick loss in screenshot 3 is the problem F1 describes.
  - Screenshots folder removed afterwards; checkout clean.

PASS