# AR0459 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. No test covers the diagram sizing or the full-size link

- Kind: test
- Found by: 2026-10-26-review-ed02aede (reviewer), 2026-10-26
- Where: `site/src/components/MarkdownContent.astro:10-29`
- What: putting `useMaxWidth: false` back, or deleting the loop that adds the link, fails no test; the site's tests run in Node with no browser page.
- Suggestion: none.
- Status: dropped (AR-D53: the site's tests have no browser; a regression is visible on the page and costs no risk)

## F2. A diagram drawn without a viewBox would open at 0x0

- Kind: fix
- Found by: 2026-10-26-review-ed02aede (reviewer), 2026-10-26
- Where: `site/src/components/MarkdownContent.astro:16`
- What: the full size comes from `svg.viewBox.baseVal`; Mermaid flowcharts always set one.
- Suggestion: none.
- Status: dropped (AR-D53: cannot happen with today's diagrams)

## F3. The full-size link's blob URL is never revoked

- Kind: perf
- Found by: 2026-10-26-review-ed02aede (reviewer), 2026-10-26
- Where: `site/src/components/MarkdownContent.astro`
- What: it lives as long as the page.
- Suggestion: none.
- Status: dropped (AR-D53: harmless)
