# Arthur's site

The landing page and docs of Arthur, at https://kacperadler.github.io/arthur/, built with Astro Starlight. It is its own npm project, outside Arthur's workspaces, so none of its dependencies reach Arthur.

No page here is written by hand. `scripts/generate.ts` runs before every `npm run dev` and `npm run build` and writes `src/content/docs/` from scratch (Git ignores it) from the repository's files:

- the landing page from `README.md`: its first paragraph under the H1 is the tagline, the rest from its first `##` is the body, with each package's name in its Features list linking that package's page, and the logo in `docs/logo/` (`arthur.svg`, else `arthur.png`), when there is one, is the hero image; the favicon is the small icon `arthur-favicon.png` when it exists, else the logo;
- the roadmap page from `spec/roadmap.md` and the board, `spec/build.json`;
- the diagram page from `arthur.mmd`, without the outline on its right, to give the diagram the width;
- the setup page from `docs/setup.md`, when it exists;
- the Plugins page (`scripts/plugins.ts`): one row per folder of `packages/`, core first, with its state and summary from its line in the README's Features list (`- **<name>**, <state>: <summary> (<links>).`) and a link to its page, then the plugins of `spec/vision.md`'s plugin table that have no package yet, as planned, each with the first sentence of its "Does" cell and no page;
- a page per package, `plugins/<name>/`: its overview, `packages/<name>/docs/<name>.md` without its H1, then each of `packages/<name>/docs/commands/*.md` in file-name order, each page's headings one level down, so its H1 is a section.

The sidebar, set in `astro.config.ts`, lists the pages above and a Plugins group, its pages under it in the Plugins page's order.

Relative links point to the files on GitHub, and a `mermaid` block is drawn in the browser, fitted whole to its column, with a link under it that opens the diagram alone at its own size in a new tab. A broken input fails the build: a README without its H1 or first paragraph, a roadmap entry number used twice, a `Roadmap <N>:` ticket for an entry the roadmap does not have, a package without a `docs/` folder or without its overview, `docs/<name>.md`, two command pages in one package whose names differ only in case, a package with no line in the README's Features list, or a `spec/vision.md` without its plugin table.

Inside `site/`: `npm ci`, then `npm test`, `npm run dev` (http://localhost:4321/arthur/) or `npm run build` (into `dist/`, `npm run preview` serves it).

`.github/workflows/site.yml` builds the site on every push and pull request, and on a push to `main` publishes it to GitHub Pages. Pages has to be switched on once, in the repository's Settings → Pages → Source: GitHub Actions; until then the deploy job fails and the build job still checks every pull request.
