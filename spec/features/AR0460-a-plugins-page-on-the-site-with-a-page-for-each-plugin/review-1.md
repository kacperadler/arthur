# AR0460 - Review 1

- Job: 2026-10-26-review-ab955ef7
- Branch: arthur/2026-10-26-worker-b6154019
- Commit reviewed: ddffdb0f8f485147ebf84fa672c244b4a71f04b7
- Verdict: PASS

## Final message

No blocking findings. The branch does everything the ticket's Done means asks, the site checks pass when I run them, and I found nothing false in the seven new overviews.

**Findings**

None.

**Notes (not blocking)**

- **Done means, point by point:**
  - **Plugins page:** the built `plugins.md` has 18 package rows, core first and the rest in alphabetical order. Each row has a state, a summary and a link. The 7 planned plugins from the vision come after, with no page.
  - **One page per package:** each is generated from the package's overview without its H1, then its command pages with every heading moved down one level. The built `dist/plugins/*` pages have no relative links left; every link goes to GitHub.
  - **Sidebar and landing page:** the sidebar shows a "Plugins" group (checked in `dist/plugins/core/index.html`). The landing page has 18 `plugins/<name>/` links.
  - **Nothing hand-written under `site/src/content/`:** `site/.gitignore:3` ignores it, `git ls-files src/content` lists 0 files, and `git status` is clean after the build.
  - **Build failures:** a missing `docs/` folder, a missing overview, two command files whose names differ only in case, a package with no README line, and a vision with no plugin table all fail the build, and each has a test.
- **Seven overviews checked against each package's options file and command pages:**
  - **core:** each option, default and description matches `core-options.ts`. The worktree guard claim matches `worktree-guard.ts:8-12`, and `./testing` is exported.
  - **delivery:** `alwaysReview` and its refusals match `delivery-options.ts`. The limit of 2 FAILs, the read-only review of the branch's tip, `take-main` and `changelog` match their command pages.
  - **machines:** every option and default matches `machine-options.ts`. Refusing a public address, never accepting a host key (`StrictHostKeyChecking=yes`) and the `machine-online`/`machine-offline` events match `commands/machines.md`.
  - **orchestration:** the defaults 3, 60, 5, 5, 1 and 3 match the constants. The claim that it is always loaded and cannot be disabled matches `core/src/host.ts:101-102`, and the `mcp` shape matches `mcp.ts`.
  - **projects:** every key and the `prompts` defaults match `project-options.ts:39-71`.
  - **schedule:** the entry shape and defaults match `schedule-options.ts`. The sweep every 10 s and the entries other plugins register (orchestration's morning report, manage's audit and retro) match `commands/schedule.md`.
  - **youtrack:** at least one instance, `timeoutSeconds` 30, `requires: ["projects"]`, a job that only reads, and no token or URL in an error all hold (`youtrack-api.ts:3`, `commands/youtrack.md:45`).
- **One test gap:** `site/scripts/plugins.ts:83` looks up `seen.get(file.toLowerCase())`. Changing that lookup to `seen.get(file)` still passes the tests, because the only test pair is `Run.md`/`run.md`, which sorts with the lowercase name second. The mutation would let a pair like `RUN.md` and `Run.md` through. Disabling the refusal outright, or making the stored key case-sensitive, is caught.
- **Commit prefix:** the second commit uses `docs(AR0460)` for a findings file; the worker says the hook refused `spec(...)`.
- **Findings file:** F1 quotes the owner's absolute home path in an error line. It is not a client or another project.
- **Build warning:** the `i18n` collection warning the worker mentions was not in the end of the build output I looked at, so I can't say whether this branch introduced it.

**Checks run**

All of these ran in the foreground inside `site/`, with `npm_config_cache` set to `.h/npm-cache` in this worktree. As you asked, I did not run Arthur's full suite, so the root `npm run check` was not run either.

- `npm ci`: 385 packages added.
- `npm test`: 32 tests, 32 pass, 0 fail.
- `npm run build`: 24 pages built, "Complete!".
- Built output: the generated `plugins.md` is as described above, the sidebar group is labelled "Plugins", and no relative links are left on the plugin pages.
- 14 mutations of `scripts/plugins.ts`, each followed by `node --test test/plugins.test.ts`, each restored with `git checkout`. The tests caught 13. The one they missed is the `seen.get(file)` lookup in the notes; that test pair simply can't tell the change apart.
  - **Refusals disabled:** missing docs, missing overview, missing README line, the case-insensitive duplicate refusal and its stored key made case-sensitive.
  - **Order:** core no longer sorted first, the sidebar order dropped.
  - **Content filters:** headings inside fenced code blocks moved anyway, the `.md` filter dropped, H1 left at its level, the plugin table read past its end, planned plugins including built ones, every Features name linked.
- `git status --short` after restoring: clean.

PASS