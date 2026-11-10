# AR0678 - Report pages draw a double border on the right of the last number tile in a row and under the tiles of the last row

```json
{
  "id": "AR0678",
  "title": "Report pages draw a double border on the right of the last number tile in a row and under the tiles of the last row",
  "date": "2026-11-10"
}
```

## Description

The number tiles of every report page (`.nums` in the base style of the report criteria) draw a 2 px border around the grid and another 2 px border right of and under each tile, so the right edge of the last tile in a row and the bottom of the last row are 4 px, and an empty cell of the last row sits inside the frame. The owner saw it on the night report of 2026-11-10 and asked that it never come back.

## Goal

Evidence: `.agents/arthur/criteria/report.md:65-66`, `.nums { ... border:2px solid var(--ink); }` and `.nums div { ... border-right:2px solid var(--ink); border-bottom:2px solid var(--ink); }`. Both lines meet at the grid's right and bottom edges. The owner's screenshot of 2026-11-10 shows it on a 5-column row and the last row.

Fix, checked on the night report of 2026-11-10 at 1000 px and 420 px: every tile has one 2 px border of its own and overlaps its neighbours, so each line is drawn once and no frame encloses the empty cells:

```css
.nums { display:grid; grid-template-columns:repeat(auto-fit, minmax(150px, 1fr)); padding:2px 0 0 2px; margin:24px 0 8px; }
.nums div { padding:14px 12px; border:2px solid var(--ink); margin:-2px 0 0 -2px; text-align:center; }
```

- Kind: fix

## Done means

- The base style in `.agents/arthur/criteria/report.md` holds the two rules above in place of lines 65-66, and the Components line on `.nums` says every line between tiles is drawn once and the last row is not framed past its tiles.
- Each copy of the old `.nums` rules elsewhere in the repository (a role or procedure that writes a page, a test fixture) gets the same rules; `grep -rn "border-right:2px solid var(--ink); border-bottom" . --exclude-dir=spec --exclude-dir=node_modules` finds none.
- The page check passes on a page built from the base style with 6 tiles, and its screenshots at 420 px show single lines; the worker says so in its summary.

## Scope

In:
- `.agents/arthur/criteria/report.md`: the two `.nums` rules and the Components line.
- Any other file holding a copy of the old rules, found with the grep above.

Out:
- Other components of the base style.

## Decisions
- 2026-11-10: AR0678 approved; the owner: "I dont like the double border on last item in first line and bottom border in first item in last line, remember do do not repeat this" (AR-D605)
- 2026-11-10: Merge AR0678 once CI on its branch passes; the owner: "AR-D621: merge" (AR-D621)
