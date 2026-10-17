# AR0106 - A conductor logo for Arthur

```json
{
  "id": "AR0106",
  "title": "A conductor logo for Arthur",
  "date": "2026-10-17"
}
```

## Description

Arthur needs a logo for its site (AR0105) and README: a conductor with a baton, the owner's choice (2026-10-17).

## Goal

The owner picks one of three variants; the chosen one is ready for the site and the README.

- Kind: improvement

## Done means

- A logo of a conductor with a baton (the owner's choice): three simple SVG variants of it, each readable at 32 px as a favicon and in one colour, rendered to PNG for the owner to choose from; the chosen one is used on the site and in the README.
- Files: `docs/logo/conductor-1.svg` to `-3.svg`, hand-written SVG (no external tool, no font: shapes only); each rendered to PNG at 512 and 32 px in the job folder and looked at; the final message names the PNG paths so the coordinator sends them to the owner.
- Nothing else changes until the owner picks; then one `docs/logo/arthur.svg` and a line in the README.
- `npm test` and `npm run check` pass.

## Scope

In:
- `docs/logo/`.

Out:
- The site (AR0105).

## Decisions

- 2026-10-17: The owner: a conductor with a baton.
- 2026-10-17: The owner picked variant 1 (the conductor seen from the side) but finds it far too primitive: the logo must look better than the Jenkins butler. A full-colour illustrated mark plus a simplified one-colour favicon version.
- 2026-10-17: The owner: the drawn logo is still weak; he will make one with ChatGPT and send it. The branch waits; its SVGs are replaced by his image.
- 2026-10-17: Takes AR0105's F1 (AR0108 dropped): the site generator copies the small-size favicon to `site/public/favicon.svg` (or .png) when it exists, else the full logo; and it accepts the owner's PNG logo, not only `docs/logo/arthur.svg`.
- 2026-10-17: The owner: the conductor is seen from behind (facing the orchestra), in the ChatGPT logo.
- 2026-10-17: The owner prefers a minimalist one-colour silhouette mark (negative space, dynamic pose, a music stand) over a detailed illustration; his reference was a stock image, not committed (a watermarked stock image cannot go into a public repository).
- 2026-10-17: The owner: code symbols ({ } ; </>) float around the baton instead of music notes.
- 2026-10-17: The owner: minimalism is the point, not one colour; a second accent colour is fine.
