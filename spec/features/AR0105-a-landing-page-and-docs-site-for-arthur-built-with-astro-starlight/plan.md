# AR0105 - Plan

- Job: 2026-10-17-plan-ticket-spec-feature-a2151279
- Planned at: a622f3d0b9e1b53d652a6f7b12fe82eed5fed391

## Approach
The site goes in a new `site/` folder. It has its own `package.json` and `package-lock.json` and stays outside the npm workspaces. The root `package.json` lists only `packages/*` under `workspaces`, so Astro, Starlight and Mermaid never reach Arthur's dependencies, the root lockfile or the root `npm ci`. The rest of the repository is checked by other means. The structure test (`test/structure.ts`, `checkStructure`) reads only the root `package.json` and `packages/*`. The root `tsconfig.json` includes only `test/` and `packages/*`. Neither needs a change.

None of the site's text is a hand-written copy. One generator script, `site/scripts/generate.ts`, runs before every `astro dev` and `astro build`. It reads the repository's files and writes the pages into `site/src/content/docs/`. Git ignores that folder, and each run rebuilds it from scratch. Starlight's `docsLoader` reads it as usual. The only hand-written words are the button labels, the page titles and one sentence at the top of the roadmap page.

The first pages:
- **Landing (`/arthur/`)**: uses Starlight's `splash` template.
  - The hero title is "Arthur".
  - The tagline is the README's first paragraph, turned into HTML, because Starlight's `Hero.astro` renders the tagline with `set:html`.
  - The hero image is the logo, `docs/logo/arthur.svg` from AR0106, copied to `site/src/assets/`. The same file is copied to `site/public/favicon.svg`.
  - The buttons are Roadmap, Diagram, Setup (once that page exists) and GitHub.
  - The body is `README.md` from its first `##` on.
- **Roadmap (`/arthur/roadmap/`)**: built from `spec/roadmap.md` and `spec/build.json`.
  - The generator reads only two kinds of heading: `## <section>` and `### <N>. <title>`. A section with no numbered entry, such as the coverage tables, is skipped. No other Markdown is parsed.
  - Each entry is matched to the board tickets titled `Roadmap <N>: …`. A merged ticket wins; otherwise the most recently updated open ticket; otherwise the entry shows "not started".
  - Each section is a table with columns entry, title, state (`built` for merged, otherwise the board status) and the ticket, linked to its `ticket.md` on GitHub. The section heading reads, for example, "Core: 22 of 22 built".
  - Then a table of open tickets that are not roadmap entries (id, title, status).
  - Then one line naming the commit and date of the board it was built from, read with `git log -1`.
- **Diagram (`/arthur/diagram/`)**: `arthur.mmd`, drawn on the page, with a link to its source.
- **Setup (`/arthur/setup/`)**: `docs/setup.md` from AR0107. The page title comes from its H1, and the rest is its body.

Two rules apply to every page built from a repository file:
- **Links**: relative Markdown links and images, and relative `<img src>`, are turned into GitHub URLs, resolved against the source file's folder. Links become `blob/main/…` and images become `raw.githubusercontent.com/…/main/…`. Fenced code blocks are left untouched.
- **Mermaid blocks**: a fenced `mermaid` block becomes a raw `<pre class="mermaid">` with its content HTML-escaped. This gives the README's own diagram on the landing page too.

The logo and the setup guide are optional inputs, because AR0106 and AR0107 are not merged. When the file is there, the hero image and the Setup page appear. When it is not, they do not, and the build passes. The first build of main after each merge picks them up with no change to the site. The other inputs are required, and a missing or broken one fails the build:
- `README.md` without an H1 or a first paragraph.
- No numbered roadmap entry, or one entry number used twice (the error names both lines).
- `build.json` that is not an array of tickets with `id`, `title`, `status` and `path`.
- A `Roadmap <N>:` ticket whose entry is not in the roadmap (the error names the ticket).

How the command docs are added later, as the ticket asks (not built now):
- The same generator gets one more loop over `packages/*/docs/commands/*.md`, writing `commands/<file>.md`.
- The title is the page's H1 (`arthur spawn`) and the body is the rest, with links rewritten the same way.
- The package name (`core`, `orchestration`, …) shows as a sidebar badge, set in frontmatter.
- Two packages with the same file name fail the build.
- Starlight builds its sidebar from the folders on its own, so the sidebar gains a Commands group with no config change.

Hosting and CI use one new workflow, `.github/workflows/site.yml`:
- It runs on every push, every pull request and by hand.
- In `site/` it runs `npm ci`, `npm test`, then `npm run build`. A generator error or an Astro error fails the check on the pull request.
- Only on a push to `main`, it uploads `site/dist` with `actions/upload-pages-artifact@v5`, and a `deploy` job publishes it with `actions/deploy-pages@v5` (`pages: write`, `id-token: write`, environment `github-pages`, concurrency group `pages`).
- In `astro.config.ts`: `site: "https://kacperadler.github.io"` and `base: "/arthur"`, as Astro's GitHub Pages guide says.
- The links the generator writes between pages are relative (`roadmap/`). That is because `LinkButton.astro`, which renders the hero buttons, does not add `base`, and Markdown links get no `base` either [INFERENCE: hero buttons read in Starlight 0.42.6; Markdown links from Astro's known behavior].

Left alone: every package under `packages/`, the root `package.json`, `package-lock.json`, `tsconfig.json`, `test/`, `ci.yml`, `README.md`, the roadmap, the vision, and `CHANGELOG.md` (it is generated). The site needs no roadmap entry, because it is not part of Arthur's runtime.

Mermaid is drawn in the browser by a small override of Starlight's `MarkdownContent` component, as recommended under Not available directly.

## Not available directly
- **Mermaid diagrams.** Starlight has no Mermaid support. A fenced `mermaid` block would be shown as code by Expressive Code. Where I checked: Starlight 0.42.6's package (components, exports `./components/*`), its overrides reference (`MarkdownContent`, which wraps every page's content in `<div class="sl-markdown-content"><slot /></div>`), and npm (`astro-mermaid` 2.1.0 accepts `mermaid` `^10 || ^11` as a peer; the latest `mermaid` is 12.2.0).
  - Option 1: `site/src/components/MarkdownContent.astro` wraps Starlight's default and adds a `<script>`. Only when the page has a `pre.mermaid`, the script loads `mermaid` with a dynamic import and calls `mermaid.run()`; a rule gives the diagram a white background so its black labels stay readable in dark mode. Cost: about 20 lines and one site dependency (`mermaid`). Risk: the diagram needs JavaScript and appears a moment after the page.
  - Option 2: the `astro-mermaid` integration. Cost: one dependency and a config line. Risk: a third-party integration whose peer range pins `mermaid` 11 while 12 is current.
  - Option 3: draw SVG at build time with `@mermaid-js/mermaid-cli`. Cost: Puppeteer and a Chromium download in every CI run. Risk: a headless browser in CI, a slow and flaky build.
  - Recommendation: Option 1.

## Files
- `site/package.json`: new. Private package, `"type": "module"`.
  - Dependencies: `astro` (7.x), `@astrojs/starlight` (0.42.x), `mermaid`.
  - Scripts: `generate` (`node scripts/generate.ts`), `dev` (`npm run generate && astro dev`), `build` (`npm run generate && astro build`), `preview` (`astro preview`), `test` (`node --test "test/*.test.ts"`).
  - `engines.node >= 24`, because Node runs the generator's TypeScript as written; Astro 7 needs at least 22.22.
- `site/package-lock.json`: new, from `npm install` inside `site/`.
- `site/.gitignore`: new. `dist/`, `.astro/`, `src/content/docs/`, `src/assets/`, `public/favicon.svg`. The root `.gitignore` already ignores `node_modules/` at any depth.
- `site/astro.config.ts`: new. `site`, `base`, and Starlight with:
  - `title: "Arthur"`;
  - a GitHub link in `social`;
  - `components: { MarkdownContent: "./src/components/MarkdownContent.astro" }`;
  - no `sidebar` key, so Starlight builds the sidebar from the generated folder, ordered by `sidebar.order` in each page's frontmatter.
- `site/src/content.config.ts`: new. The `docs` collection with `docsLoader()` and `docsSchema()`, as in Starlight's manual setup.
- `site/src/components/MarkdownContent.astro`: new. The Mermaid override (Option 1).
- `site/scripts/generate.ts`: new. File access only, as one `import.meta.main` entry:
  - reads the sources;
  - empties and rewrites `src/content/docs/`;
  - copies the logo when there is one;
  - writes `index.md`, `roadmap.md`, `diagram.md`, and `setup.md` when its source exists.
- `site/scripts/markdown.ts`: new. Pure functions:
  - frontmatter, written as JSON strings, which YAML reads;
  - the README split into tagline and body, with the tagline turned into HTML (inline code, links and escaping);
  - the link and image rewrite outside fenced blocks;
  - the `mermaid` fence turned into `<pre class="mermaid">`.
- `site/scripts/roadmap.ts`: new. Pure functions: the heading parse, the join with the board, and the Markdown tables, with the errors listed under Approach.
- `site/test/markdown.test.ts`, `site/test/roadmap.test.ts`: new. `node:test` cases on those functions (see How to test).
- `site/README.md`: new, a few lines:
  - what the site is built from;
  - `npm ci`, `npm run dev`, `npm run build` inside `site/`;
  - the owner's one-time setting (Settings → Pages → Source: GitHub Actions);
  - how command pages will be added.
- `.github/workflows/site.yml`: new. Build on every push and pull request; deploy on a push to `main`.

## Risks
- **Astro entering Arthur's dependencies.**
  - `site/` is not in `workspaces`, and `npm ci` in `site/` should treat it as a project of its own [INFERENCE: npm takes the nearest `package.json` and joins a workspace root only when the folder matches its globs; checked at build, see How to test].
  - The structure test never reads `site/`, so Astro in `site/package.json` breaks no rule. Root CI (`ci.yml`) is unchanged.
- **A page lying about the state.**
  - The pages are rebuilt from the files on every push to `main`, and the roadmap page names the commit it came from.
  - The tests cover the join between the roadmap and the board, including its edge cases.
- **A board or roadmap edit that breaks the build blocks the deploy.**
  - That is intended: CI catches it on the pull request. The site stays on its last good version, because the deploy runs only after a passing build.
- **Wrong links under `/arthur/`.** Page-to-page links are relative, and links into the repository are absolute GitHub URLs. The build check below opens the pages under the real base.
- **Raw HTML in the README** (for example an `<img>` that AR0106 adds) with a relative `src` is rewritten too. Other HTML is passed through untouched; the README holds none today.
- **A long tagline.** The README's first paragraph is five sentences. The owner shortens it in the README if the hero looks heavy; the site follows.
- **Mermaid on the client** adds a large script. The dynamic import loads it only on pages that have a diagram (the landing page and the diagram page).
- **Pages not switched on.** The first deploy fails until the owner sets Settings → Pages → Source: GitHub Actions. This is noted in `site/README.md`. Before that, the build job still guards pull requests.
- **The vision says Arthur exposes nothing to the internet.** Unchanged: the site is static files on GitHub's servers. Nothing listens on Arthur's machine, and the site shows only what the public repository already holds.
- **Type checking.** `site/` has no `astro check`: that would need `@astrojs/check` and `typescript` in the site. Node runs the generator's TypeScript without checking types, so its behavior is held by its tests and the build.

## How to test
- **The plan, approved by the owner (Done means 1).** This document settles:
  - where the site lives (`site/`, outside the workspaces);
  - hosting (GitHub Pages through `site.yml`, at `kacperadler.github.io/arthur`);
  - the first pages (landing with the logo, roadmap, diagram, setup guide);
  - how the command pages are added later (one more generator loop);
  - how CI catches a broken build (the build job on every pull request).
- **Built only after approval (Done means 2).** The worker starts only on the owner's "ok".
- **Site build.** In `site/`: `npm ci && npm test && npm run build` exits 0. `dist/index.html`, `dist/roadmap/index.html` and `dist/diagram/index.html` exist. There is no `dist/setup/` while `docs/setup.md` is missing.
- **Optional inputs.** With a local `docs/setup.md` and `docs/logo/arthur.svg` (not committed), the build also has `dist/setup/index.html`, the hero `<img>` and `favicon.svg`. Remove them afterwards.
- **Pages in a browser.** `npm run preview`, then open `http://localhost:4321/arthur/`:
  - the hero, its buttons and the README sections show;
  - a link to `spec/vision.md` goes to GitHub;
  - Roadmap and Diagram open under `/arthur/`;
  - both Mermaid diagrams are drawn.
- **Roadmap page matches the README.** It shows Core 22 of 22 built, orchestration entry 23 built and 24 `planned`, projects 41 built, and entry 77 `planning`, matching `README.md` and `build.json` today.
- **Tests in `site/test/`:**
  - an entry with a dropped ticket and a merged one shows built;
  - an entry with only a dropped ticket shows not started;
  - an entry with no ticket shows not started;
  - a duplicate entry number fails, naming both lines;
  - a `Roadmap 99:` ticket with no entry fails, naming the ticket;
  - a section without numbered entries is skipped;
  - links are rewritten relative to the source file's folder (`docs/setup.md` → `docs/deploy.md`); images go to the raw URL; `#licence` and `https://` links are untouched;
  - nothing inside a fenced block is rewritten;
  - a `mermaid` fence becomes an escaped `<pre class="mermaid">`.
- **A broken input fails the build.** Locally, duplicate a `### 1.` heading in `spec/roadmap.md`: `npm run build` exits non-zero with the error naming both lines. Revert.
- **Arthur untouched.** At the root, `npm ci && npm run check && npm test` pass, and `git diff --stat main -- package.json package-lock.json packages/ test/ tsconfig.json` is empty.
- **CI.** On the worker's branch, `site.yml` runs the build job and skips deploy. After the merge, and once the owner sets Pages to GitHub Actions, the deploy job runs and `https://kacperadler.github.io/arthur/` serves the landing page.

## Open questions
- Should the site go live before AR0106 (logo) and AR0107 (setup guide) are merged, with the logo and the Setup page appearing once their files are on `main`? Or should AR0105's build wait for both (`arthur ticket after AR0105 AR0106 AR0107`), with the generator then requiring both files? The plan follows the first.
