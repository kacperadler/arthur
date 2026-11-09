# AR0663 - Review 1

- Job: 2026-11-09-review-e4eff6ae
- Branch: arthur/2026-11-09-worker-e677416d
- Commit reviewed: 33cc6ec224ebe8beb89cd26704fe96487f53dfe9
- Verdict: FAIL

## Final message

I'm failing this review. The bold rule still turns some globs into bold, so the Done means point "`src/**/*.ts` … stay as typed" is only partly met, and the new doc sentence claims more than the code does.

## Findings

1. **`packages/manage/src/report-file.ts:83`: a `**`-led glob and a later glob on the same line still become bold.** The regex is `` (?<!\S)\*\*(?=\S)(.+?)(?<=\S)\*\*(?!\w) ``. It lets the opening mark be followed by `/` and the closing mark by `/` or end of text. So any glob starting `**/` acts as an opening mark, and the next `/**` on the line closes it. I ran `reportPage` on these inputs on 33cc6ec2:
   - `**/*.ts and src/**/*.ts` → `<strong>/*.ts and src/</strong>/*.ts`. This is the ticket's own symptom, with the ticket's own glob `src/**/*.ts`.
   - `globs **/roles/** and .agents/**` → `globs <strong>/roles/</strong> and .agents/**`. `packages/delivery/docs/commands/review-needed.md:25` already uses globs like these (inside backticks there).
   - `use **/*.ts or packages/**` → `use <strong>/*.ts or packages/</strong>`.

   The Done means asks for `<strong>` only around a word run, with globs staying as typed. `/*.ts and src/` is not a word run. The new test only covers globs whose `**` sits in the middle of a path, so it misses this case.

2. **`packages/manage/docs/manage.md:115` (and the comment at `report-file.ts:80-81`) states a rule the code does not hold.** It says "no word or path glued to them outside". The closing mark in `src/**/*.ts` is glued to a path on both sides, yet the code accepts it as a closing mark, as finding 1 shows. A closing mark followed by `/` should be refused, and so should an opening mark followed by `/`. For example, `(?=[^\s/])` after the opening mark and `(?![\w/])` after the closing one. Add a test line such as `**/*.ts and src/**/*.ts`.

## Notes

- (risk) `packages/manage/src/report-file.ts:83`: bold after punctuation is lost. The `(?<!\S)` before the opening mark means `(**x**)` and `"**y**"` now stay as typed; the base made them bold. These forms are common in Markdown that agents write, and the doc does not mention the change.
- (minor) `packages/manage/src/report-file.ts:102`: a fence line is only seen when the backticks come right after `> `. A fence indented inside the quote (`>   ```ts`) still shows as text and does not start a fenced block.

## Checks (all on 33cc6ec2)

- `npm run check`: tsc clean.
- `npm test`: 1671 tests, 1607 pass, 0 fail, 64 skipped.
- `npm run mutate`: 15 mutants, 15 caught, 0 survived. That is every mutant of the change, so it reaches the min(25, all) bar.
- The `node -e` run of `reportPage` on the inputs in finding 1 printed the outputs quoted there. On that same run, `2 ** 3`, `**a**, **b**.` and a fenced Before/After quote (fence lines hidden, `**x**` kept as typed, the After column formatted normally again) render as the worker says.
- `git status --short` was clean after the runs.

FAIL