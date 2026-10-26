# AR0459 - Outcome

- Merged: 2026-10-26, `8113159f`
- Branch: arthur/2026-10-26-worker-e5d458b3
- Reviews: review-1.md PASS
- Cost: worker $1.06, reviews n/a; review rounds 1

## What went in

- `site/src/components/MarkdownContent.astro`: Mermaid fits each diagram to its column (no inner scroll box), never larger than its own size; under each diagram an "Open the diagram at full size" link opens the SVG at its own size in a new tab.
- `site/scripts/generate.ts`: the diagram page has no right-hand outline, so the diagram gets the wider column.
- `site/test/generate.test.ts`: the diagram page drops its outline and holds the escaped block and the link to `arthur.mmd`.
- `site/README.md`: describes the fitted diagram and the full-size link.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1111/1177 passed.

## Left open

- None: the review's notes F1 to F3 are dropped (findings.md).
