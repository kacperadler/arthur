# AR0663 - A bare ** in report page text becomes bold, so globs and code lose it

```json
{
  "id": "AR0663",
  "title": "A bare ** in report page text becomes bold, so globs and code lose it",
  "date": "2026-11-08"
}
```

## Description

On the report-style pages Arthur sends the owner (retro, pyramid, repeats), a `**` that is not a pair of bold marks around words becomes bold anyway, and code quoted in a Before/After column goes through the prose formatting. Globs and quoted code then read wrong on the owner's phone.

## Goal

Found by the AR0661 review (2026-11-08-review-428926fc, Notes) and the AR0661 worker's finding F1:
- `packages/manage/src/report-file.ts:80`: `files under src/**/*.ts and test/**/*.ts` renders as `src/<strong>/*.ts and test/</strong>/*.ts`; `const n = 2 ** 3 ** 2;` in a Before/After quote renders as `2 <strong> 3 </strong> 2`.
- F1: in a Before/After column, a template literal's backticks become a code chip and vanish, and ```` ```ts ```` fence lines show as typed (proposals 1 and 4 of `spec/retro/2026-11-06.html`; the pyramid page too).

- Kind: fix

## Done means

- `**` becomes `<strong>` only around a word run (`**text**`, no space just inside the marks); a glob `src/**/*.ts` and `2 ** 3` stay as typed.
- Text quoted as code in a Before/After column (a fenced block) shows as code: its backticks and `**` as typed, no fence lines shown.
- Tests in `packages/manage/test/` for both, failing before the change; `npm run check`, `npm test` and `npm run mutate -- --max 25` pass on the clean tip.

## Scope

In:
- `packages/manage/src/report-file.ts`: the bold rule and the Before/After code quoting.
- `packages/manage/test/` (the test of `reportPage`).

Out:
- Markdown links in the page text; any change to the page style.

## Decisions

- 2026-11-09: Approve AR0663; the owner: "Approve AR0663 to AR0667" (AR-D576)
- 2026-11-09: Merge AR0663 once CI is green; the owner: "AR-D588 - 1" (AR-D588)
