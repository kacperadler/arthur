# AR0612 - The /repeats page follows the report style (report.md)

```json
{
  "id": "AR0612",
  "title": "The /repeats page follows the report style (report.md)",
  "date": "2026-11-03",
  "budget": 2
}
```

## Description

The page `/repeats` sends the owner is built from the base style of the report criteria: the black, white and blue palette, a header, a centred `main` at most 900 px wide, and the light colour scheme. It then looks like every other report he gets.

## Goal

`/repeats` is the only page code builds and sends straight to the owner; it skips the report check and uses older colours and layout than the style the owner set (AR-D298).

- Kind: ux

Evidence:
- `packages/manage/src/repeats-command.ts:14-16`: the comment says "The report style the owner set (AR-D298)", but the CSS uses ink `#000`, blue `#1d4ed8`, red `#b91c1c`, blue headings and a body 46em wide.
- `.agents/arthur/criteria/report.md:3,7-9`: every HTML page sent to the owner uses ink `#0a0a0a`, blue `#0033ff` and red `#d40000`; `report.md:12,23`: `<meta name="color-scheme" content="light">`, a header, then `main` at most 900 px wide with centred headings.
- `repeats-command.ts:82`: the page has no `color-scheme` meta, no header and no `main`.
- AR0564 (which wrote `report.md`) merged before AR0562 (`f60b89db` before `202a0e93`).
- `packages/manage/test/repeats.test.ts:215` pins the old colours, `color:#000` and `#1d4ed8`.

## Done means

- The page uses `report.md`'s base style: palette, `color-scheme`, a header, `main`, the `code` rule; red only on the two sections that already use it.
- The report check of `report.md` prints `ok` for a page built from a test fixture.
- `packages/manage/test/repeats.test.ts` checks the new palette and structure instead of the old colours.
- The doc's "The page" paragraph describes it.
- `npm run check` and `npm test` pass.

## Scope

In:
- `packages/manage/src/repeats-command.ts`: the page's CSS and markup.
- `packages/manage/test/repeats.test.ts`.
- The repeats doc's "The page" paragraph.

Out:
- Sharing CSS across plugins.
- The plain page `arthur ticket file` writes.

## Decisions

- 2026-11-03: Source: audit spec/quality/2026-11-03.md
- 2026-11-03: AR0612 approved: the /repeats page follows the report style; after Group 2; the owner: "ok" (AR-D467)
