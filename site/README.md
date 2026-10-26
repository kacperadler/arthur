# Arthur's site

The landing page and docs of Arthur, at https://kacperadler.github.io/arthur/, built with Astro Starlight. It is its own npm project, outside Arthur's workspaces, so none of its dependencies reach Arthur.

No page here is written by hand. `scripts/generate.ts` runs before every `npm run dev` and `npm run build` and writes `src/content/docs/` from scratch (Git ignores it) from the repository's files:

- the landing page from `README.md`: its first paragraph under the H1 is the tagline, the rest from its first `##` is the body, and the logo in `docs/logo/` (`arthur.svg`, else `arthur.png`), when there is one, is the hero image; the favicon is the small icon `arthur-favicon.png` when it exists, else the logo;
- the roadmap page from `spec/roadmap.md` and the board, `spec/build.json`;
- the diagram page from `arthur.mmd`, without the outline on its right, to give the diagram the width;
- the setup page from `docs/setup.md`, when it exists.

Relative links point to the files on GitHub, and a `mermaid` block is drawn in the browser, fitted whole to its column, with a link under it that opens the diagram alone at its own size in a new tab. A broken input (a README without its H1 or first paragraph, a roadmap entry number used twice, a `Roadmap <N>:` ticket for an entry the roadmap does not have) fails the build.

Inside `site/`: `npm ci`, then `npm test`, `npm run dev` (http://localhost:4321/arthur/) or `npm run build` (into `dist/`, `npm run preview` serves it).

`.github/workflows/site.yml` builds the site on every push and pull request, and on a push to `main` publishes it to GitHub Pages. Pages has to be switched on once, in the repository's Settings → Pages → Source: GitHub Actions; until then the deploy job fails and the build job still checks every pull request.

Command pages come later from `packages/*/docs/commands/*.md`: one more loop in `scripts/generate.ts` writes each as `commands/<file>.md`, its H1 the title, the package name a sidebar badge, and links rewritten the same way; two packages with the same file name fail the build. Starlight's sidebar picks up the new folder by itself.
