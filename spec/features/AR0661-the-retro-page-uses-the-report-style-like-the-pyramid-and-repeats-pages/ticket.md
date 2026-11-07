# AR0661 - The retro page uses the report style, like the pyramid and repeats pages

```json
{
  "id": "AR0661",
  "title": "The retro page uses the report style, like the pyramid and repeats pages",
  "date": "2026-11-07"
}
```

## Description

The phone page of a retro (`spec/retro/<date>.html`, sent by `/retro`) looks like every other page Arthur sends the owner: the report style of `.agents/arthur/criteria/report.md` (black header, blue accent, centred `main`, tables and code chips), with its Markdown shown as formatting, not as raw `**` and `- ` characters.

## Goal

The owner asked on 2026-11-07, on Discord: "we defined styles for arthur documents like retro etc, why this retro do not have that style?"

Evidence:
- `packages/manage/src/retro-due.ts:11`: `RETROS` uses `page` from `report-file.ts`, the plain page (`report-file.ts:55-70`): one system font, no colours, each block between headings a `<p>` with `white-space: pre-wrap`, so `**bold**`, `- ` bullets and backticks show as typed.
- `spec/retro/2026-11-06.html`, the last retro's page, shows exactly that.
- `.agents/arthur/criteria/report.md:3` names "a retro's page" among the pages in the report style, and in the same line exempts "the plain page `arthur ticket file` writes beside a retro's report": the exemption is the gap.
- `report-file.ts` already has `reportPage` (lines 89-125), the report style used by `/repeats` and the pyramid page (`pyramid.ts:18`).

- Kind: fix

## Done means

- A retro filed with `arthur ticket file <retro job>` writes its page through the report style: `# Retro <date>` and its `- Job:` and `- Merges up to:` lines in the header, each `##` and `###` a heading in `main`, `- ` lines as a list, `**text**` bold, backticked spans as `code`.
- The plain `page` function is deleted if nothing else uses it.
- `spec/retro/2026-11-06.html` is written again from `spec/retro/2026-11-06.md` with the new page, and passes the report check of `.agents/arthur/criteria/report.md` ("The check": `ok:` at 420 px), its screenshots looked at.
- `report.md:3` no longer exempts the retro page; `packages/manage/docs/manage.md` (the retro section, line 115) describes the page as in the report style.
- A test in `packages/manage/test/retro.test.ts` files a retro whose final message holds a bullet, bold text and a backticked command, and asserts the page has the report style's header, a list item, a `<strong>` and a `<code>`, and no raw `**`; it fails on today's plain page.
- `npm run check`, `npm test` and `npm run mutate -- --max 25` pass on the clean tip.

## Scope

In:
- `packages/manage/src/report-file.ts` (render `- ` lists and `**bold**` in `reportPage`, if it does not yet; delete `page` if unused)
- `packages/manage/src/retro-due.ts` (`RETROS.page` becomes `reportPage`)
- `packages/manage/test/retro.test.ts`
- `packages/manage/docs/manage.md`, `.agents/arthur/criteria/report.md` (line 3 only)
- `spec/retro/2026-11-06.html` (written again)

Out:
- The retro's report text and its role; the pyramid and repeats pages beyond what sharing the renderer needs; a new style.

## Decisions

