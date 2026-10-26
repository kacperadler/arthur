# AR0459 - The site draws each diagram at its own size in a small scrolling box, so a reader sees mostly empty space

```json
{
  "id": "AR0459",
  "title": "The site draws each diagram at its own size in a small scrolling box, so a reader sees mostly empty space",
  "date": "2026-10-26"
}
```

## Description

The owner (2026-10-26, Telegram, with a screenshot of https://kacperadler.github.io/arthur/diagram/): the diagram on the site "looks bad, really bad". A reader sees a white box with a corner of the drawing and no labels. After this, each diagram on the site is seen whole on opening, and the full diagram can still be read at its own size.

## Goal

Evidence, measured in Chromium at 1280x800 on the live site, 2026-10-26:
- `/arthur/diagram/`: the SVG of `arthur.mmd` is 3935 x 2753 px inside a `pre.mermaid` box 630 x 638 px; the visible part is the empty top-left corner of two subgraph borders.
- `/arthur/` (the landing page, the README's small diagram from AR0450): 1630 x 748 px in a 1078 x 638 px box; the top half visible is blank, the plugin row is cut.
- Cause: `site/src/components/MarkdownContent.astro` sets `flowchart: { useMaxWidth: false }` and the box `overflow: auto; max-height: 80vh`, so each diagram is drawn at its natural size and scrolled inside a small box.

- Kind: fix

## Done means

- On the landing page the README's small diagram fits the content column whole (no inner scroll), its labels readable at 1280 px wide.
- On the diagram page `arthur.mmd` is seen whole on opening (fitted to the page's width; the page may drop its right-hand outline to give it room), and one click or a link opens it at its own size, where the browser's own zoom and scroll read every label (for example the SVG alone in a new tab).
- Checked in a real browser at 1280x800 and at a phone width (390x844): a screenshot of each page attached to the final message; no label is cut and no blank box is left.
- `site/` tests pass (`npm test` inside `site/`), and `npm run build` there builds.

## Scope

In:
- `site/src/components/MarkdownContent.astro`: Mermaid's sizing and the box's style; the full-size view.
- `site/scripts/generate.ts`, `site/scripts/markdown.ts`: only if the diagram page needs its own layout or link.
- `site/test/*`: a test for what the generator writes.

Out:
- The diagrams' content (`arthur.mmd`, the README's block): unchanged.
- A plugins page: AR0460.

## Decisions

