# AR0108 - The site's favicon is the full logo, while AR0106 draws a favicon of its own

```json
{
  "id": "AR0108",
  "title": "The site's favicon is the full logo, while AR0106 draws a favicon of its own",
  "date": "2026-10-17"
}
```

## Description

as the plan says, the generator copies `docs/logo/arthur.svg` to both the hero image and `site/public/favicon.svg`. AR0106's worktree (not merged) also holds `docs/logo/arthur-favicon.svg`, a version drawn for small sizes; the full logo shrunk to 16 px loses its detail.

## Goal

What we are after, what it moves in `spec/vision.md`, and the evidence (file:line, a command and its output). A mechanical, fully specified change (a rename, a moved section, a list of exact edits) adds `- Model: haiku` under Kind; anything with behaviour to judge has no Model line.

- Kind: feat

Evidence:
- `site/scripts/generate.ts:20-26`
- Found by: 2026-10-17-ar0105-site-727a494f (worker), 2026-10-17

## Done means

- The fix, with a test that proves it: once AR0106 is merged, copy `docs/logo/arthur-favicon.svg` to `favicon.svg` when it exists, and `arthur.svg` otherwise. Nothing else in the site changes.
- `npm test` and `npm run check` pass.

## Scope

In:
- once AR0106 is merged, copy `docs/logo/arthur-favicon.svg` to `favicon.svg` when it exists, and `arthur.svg` otherwise. Nothing else in the site changes.

## Decisions

- 2026-10-17: Source: F1 of AR0105
