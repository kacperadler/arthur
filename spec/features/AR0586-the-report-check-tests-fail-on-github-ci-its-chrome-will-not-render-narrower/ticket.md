# AR0586 - The report check tests fail on GitHub CI: its Chrome will not render narrower than 500 px

```json
{
  "id": "AR0586",
  "title": "The report check tests fail on GitHub CI: its Chrome will not render narrower than 500 px",
  "date": "2026-10-30",
  "budget": 4
}
```

## Description

Since AR0564 merged, CI fails on main and on every branch cut from it: the page check of the report skill renders at 500 px on GitHub's runner, not 420, so its tests fail there while they pass on this server. After this, the check renders at 420 px on both, and CI is green again.

## Goal

Every merge needs CI passed on its branch, so a red main blocks every merge of the AR0561 tickets and the audit fixes.

Evidence:
- CI runs 41021378094 (the AR0564 merge, f60b89db), 41021445812, 41022270354, 41022300708 and 41022384106 on main all fail; 41020934305, just before the merge, passed.
- `arthur ci arthur/2026-10-30-worker-03eda5fc`: `test/report-check.test.ts:179` and others fail with `rendered 500 px wide, not 420` and `the page scrolls sideways: 900 px wide on a 500 px screen`.
- The check (`.agents/arthur/criteria/report.md`, the `page-check` block) passes `--window-size=420,<h>` to the first browser it finds; the test (`test/report-check.test.ts:46`) finds `chromium`, `chromium-browser` or `google-chrome` before Playwright's `chrome-headless-shell`. The runner's Google Chrome in its headless mode keeps a window at least 500 px wide [INFERENCE: the worker confirms on CI]; this server's browser honours 420.

- Kind: fix

## Done means

- The check renders the page 420 px wide whatever Chrome or Chromium it finds (for example a 420 px wide frame or a viewport set another way than the window), or finds a browser that honours it first, in both the check and the test; the 420 px width guard stays.
- The report-check tests pass locally and on GitHub's runner: the branch's CI run is green, named in the final message.
- A test fails when the fix is removed, where a local browser can show it (for example a wrapper browser that ignores a window under 500 px); else the CI run before and after is the proof.
- `npm run check` and `npm test` pass.

## Scope

In:
- `.agents/arthur/criteria/report.md` (the page-check script and its text).
- `test/report-check.test.ts`.
- `.github/workflows/ci.yml` only if a browser step is the fix.

Out:
- The style rules and the colour check stay as they are.

## Decisions
- 2026-10-30: AR0586 approved; it starts first, in the next free slot, budget $4; the owner: "i have to focus on my work, go with recomendations and do not cross 70% of weekly usage, do to silent mode" (AR-D362)

