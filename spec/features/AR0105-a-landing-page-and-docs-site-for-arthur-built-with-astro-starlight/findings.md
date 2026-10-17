# AR0105 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

## F1. The site's favicon is the full logo, while AR0106 draws a favicon of its own

- Kind: improvement
- Found by: 2026-10-17-ar0105-site-727a494f (worker), 2026-10-17
- Where: `site/scripts/generate.ts:20-26`
- What: as the plan says, the generator copies `docs/logo/arthur.svg` to both the hero image and `site/public/favicon.svg`. AR0106's worktree (not merged) also holds `docs/logo/arthur-favicon.svg`, a version drawn for small sizes; the full logo shrunk to 16 px loses its detail.
- Suggestion: once AR0106 is merged, copy `docs/logo/arthur-favicon.svg` to `favicon.svg` when it exists, and `arthur.svg` otherwise. Nothing else in the site changes.
- Status: open
