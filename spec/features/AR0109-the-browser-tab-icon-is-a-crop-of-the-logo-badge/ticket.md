# AR0109 - The browser tab icon is a crop of the logo badge

```json
{
  "id": "AR0109",
  "title": "The browser tab icon is a crop of the logo badge",
  "date": "2026-10-17"
}
```

## Description

The owner does not like the traced silhouette favicon (`docs/logo/arthur-favicon.svg`). The site's tab icon becomes a round crop of the logo badge (`docs/logo/arthur.png`): the conductor's head and shoulders with the gold code symbols, in a gold ring, as in `approved-crop.png`.

## Goal

- Kind: improvement

The crop the owner approved is drawn by `approved-crop.html` (CSS on `docs/logo/arthur.png`): a circle of size s, a gold `#e0a526` ring of `max(1, s/24)` px, navy `#19233f` fill, the logo scaled to width `2.1 s`, shifted left by `0.55 s` and up by `0.16 s`. The top rim of the original badge must not show (the owner marked it on 2026-10-17).

## Done means

- `docs/logo/arthur-favicon.png` (and a 32 px `arthur-favicon-32.png` if the site needs it) shows that crop, with transparent corners outside the circle; at 32 px the head and shoulders read. Render 128, 32 and 16 px to the job folder and name them in the final message.
- `docs/logo/arthur-favicon.svg` is removed; `site/scripts/generate.ts` uses the PNG favicon when it exists, else the logo, with the existing test updated to that.
- `npm test`, `npm run check`, and in `site/` `npm test` and `npm run build` pass.

## Scope

In:
- `docs/logo/`: the new favicon PNG, the SVG removed.
- `site/scripts/generate.ts`, `site/test/generate.test.ts`, `site/astro.config.ts` if it names the favicon type.

Out:
- The logo badge itself and the README.

## Decisions

- 2026-10-17: The owner picked option 1 of four (a crop of the badge), cropped lower so the badge's top rim does not show; `approved-crop.png` is the approved look.
