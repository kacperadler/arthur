# AR0375 - The CI workflows set no `permissions` and pin actions and the site's runner by tag (AR0311 F16, confirmed)

```json
{
  "id": "AR0375",
  "title": "The CI workflows set no `permissions` and pin actions and the site's runner by tag (AR0311 F16, confirmed)",
  "date": "2026-10-23"
}
```

## Description

`GITHUB_TOKEN` of the `check` and `build` jobs is whatever the repository's Actions setting makes the default, which the workflow does not state, and a tag `@v4`/`@v5` is whatever the action's repository points it at on the day; the site's `build` job runs the lifecycle scripts of 466 packages (`fsevents` has one today) with that token on every push and pull request. No test reads `.github/`, so a workflow that loses its `permissions` block or a pin later is not caught.

## Goal

The CI workflows set least `permissions` for every job and pin actions and the runner by version or commit.

- Kind: security

Evidence:
- `.github/workflows/ci.yml:1-21` (no `permissions:` at any level; `actions/checkout@v4`, `actions/setup-node@v4` at `:11-12`), `.github/workflows/site.yml:9-25` (the `build` job: no `permissions:`, `ubuntu-latest` at `:10`, the same two actions at `:15-16`, `actions/upload-pages-artifact@v5` at `:23`; `npm ci` of the site's 466 packages at `:21`), `:30` (`ubuntu-latest` of `deploy`), `:42` (`actions/deploy-pages@v5`)
- Found by: 2026-10-23-ar0328-security-check-41d0fc72 (worker), 2026-10-23

## Done means

- The fix, with a test that proves it: `permissions: contents: read` at the top of both workflows (`deploy` keeps its own `pages: write`, `id-token: write`); each `uses:` pinned to the action's commit with the tag as a comment (`actions/checkout@<sha> # v4`); `runs-on: ubuntu-24.04` in `site.yml` as in `ci.yml`. Test: in `test/structure.test.ts`, over `.github/workflows/*.yml` as this repository has them: each file has a top-level `permissions:` and every `uses:` is `@<40 hex>`, which fails when either is removed. Out: a Dependabot or Renovate config for the pins and the site's dependencies, a decision of the owner's.
- `npm test` and `npm run check` pass.

## Scope

In:
- `permissions: contents: read` at the top of both workflows (`deploy` keeps its own `pages: write`, `id-token: write`); each `uses:` pinned to the action's commit with the tag as a comment (`actions/checkout@<sha> # v4`); `runs-on: ubuntu-24.04` in `site.yml` as in `ci.yml`. Test: in `test/structure.test.ts`, over `.github/workflows/*.yml` as this repository has them: each file has a top-level `permissions:` and every `uses:` is `@<40 hex>`, which fails when either is removed. Out: a Dependabot or Renovate config for the pins and the site's dependencies, a decision of the owner's.

## Decisions

- 2026-10-23: Source: F3 of AR0328
- 2026-10-23: Coordinator (free hand, finding ticket) approved; starts after the ten security checks AR0319-AR0328.
