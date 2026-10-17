# AR0105 - Outcome

- Merged: 2026-10-17, `b377424`
- Branch: h/2026-10-17-ar0105-site-727a494f
- Reviews: review-1.md PASS
- Cost: worker $2.85, reviews $0.89; review rounds 1

## What went in

- `site/`: its own npm project (Astro Starlight, Mermaid), outside the workspaces. `scripts/generate.ts` rebuilds the pages before each build: the landing page from the README, the roadmap, the diagram, and the setup page and logo when their files exist.
- `site/scripts/markdown.ts` points relative links and images at GitHub and turns `mermaid` blocks into diagrams the browser draws, at their own size in a scrolling box; `site/scripts/roadmap.ts` joins each roadmap entry to its ticket on the board and fails the build on broken input.
- `site/src/components/MarkdownContent.astro` loads Mermaid only on pages with a diagram; `astro.config.ts` serves the site under `/arthur`.
- `.github/workflows/site.yml` builds on every push and pull request and deploys to GitHub Pages only on a push to `main`.

## Checks on main

- `npm run check`: passed.
- `npm test`: 357/357 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Tickets from findings: none; F1 folded into AR0106.
