# AR0105 - Review 1

- Job: 2026-10-17-review-ar0105-site-5535afa4
- Branch: h/2026-10-17-ar0105-site-727a494f
- Commit reviewed: 86d6032ad09484c193ee4f346385a56ac0140ec5
- Verdict: PASS

## Final message

Worktree clean, no leftover edits from mutation testing.

---

**Findings:** none that block merge.

**Notes (non-blocking):**
- `site/scripts/roadmap.ts` join logic: when two tickets both have status `merged` for the same entry, the last one encountered in board order silently wins (no "first merged wins" guard, deliberately dropped per final message). Correct for valid data; only matters for an already-inconsistent board, which is out of scope.
- `repoUrl` on a relative target with `../../` beyond the source's folder (e.g. `docs/setup.md` → `../../etc/x`) produces a malformed `blob/main/../etc/x` GitHub URL instead of clamping to repo root. Not a security issue (input is trusted repo-owned Markdown, not reachable from an untrusted source) and not required by the plan's edge-case list; just a rendering quirk in a case that won't occur with real content.
- F1 in `findings.md` correctly deferred (depends on unmerged AR0106).

**Checks run (in this worktree):**
- Root: `npm ci && npm run check && npm test` → `tsc` clean, 357/357 tests pass. `git diff --stat` on root config/packages/test files vs base is empty.
- `site/`: `npm ci && npm test && npm run build` → 20/20 tests pass; 4 pages built (`index`, `roadmap`, `diagram`, `404`), no `dist/setup/` (matches: `docs/setup.md` absent).
- Optional inputs: placed a fake `docs/setup.md` and `docs/logo/arthur.svg`, rebuilt → 5 pages, `dist/setup/index.html`, `favicon.svg`, `src/assets/arthur.svg` all appear; removed the files, regenerated → `src/assets` and favicon gone again. Confirmed clean `git status` after.
- Broken roadmap: duplicated `### 1.` at lines 18/27 in `spec/roadmap.md`, rebuilt → threw `entry 1 is used twice, at lines 18 and 27`, exact match to the worker's claim; reverted, confirmed clean tree.
- Roadmap/board join against today's real `spec/build.json`: entry 23 built (AR0094), entry 24 planned (AR0084), entry 41 built (AR0087), entry 77 planning (AR0086) — exact match to the worker's claim.
- Mermaid wiring in built output: `pre.mermaid` present on `index` and `diagram` pages (README has a `mermaid` fence too), mermaid JS bundle referenced only on those pages, absent from `roadmap`/`404` — confirms the "loads only on pages with a diagram" claim statically (no browser available in this environment to confirm the 56-node render claim, which the worker reports from their own Playwright run).
- Mutation testing (each reverted via `cp`/restore, confirmed clean afterward):
  - Disabled the duplicate-entry-number guard in `parseRoadmap` → caught (1 test failure, exact spot).
  - Disabled the anchor/absolute-URL/protocol pass-through in `repoUrl` → caught (link-rewrite test fails with garbled output).
  - Disabled the fenced-code-span skip in `rewriteLine` → caught (crashes, test fails).
  - Changed `open()` to no longer exclude `dropped` tickets → caught (roadmap page wrongly lists dropped tickets, test fails).
- Shape/boundary checks: all new `site/*.ts` files ≤108 lines; no `class`/`enum` in source; no `index.ts`/`types.ts`/`utils.ts`; root `tsconfig.json` and `test/structure.test.ts` never reference `site/`; `site/` has its own `package.json` outside `workspaces: ["packages/*"]`.
- `.github/workflows/site.yml`: YAML parses (`python3 -c "import yaml..."`); build job has no elevated permissions; deploy job scoped to `pages: write` + `id-token: write` only, gated on `github.event_name == 'push' && github.ref == 'refs/heads/main'`, matching the plan's least-privilege design.
- No secrets, no non-English text, no listening service, no reference to a client/project other than Arthur (the `kacperadler/arthur` GitHub URLs are Arthur's own repo, per the ticket's own Decision).

All Done-means points, plan details, and the task's Focus items (site outside workspaces/root `npm ci`, generator fails on each listed broken input, `site.yml` deploy-only-on-push-to-main with least permissions, no client/project leak) verified directly against the running code, not just the worker's claims.

PASS
