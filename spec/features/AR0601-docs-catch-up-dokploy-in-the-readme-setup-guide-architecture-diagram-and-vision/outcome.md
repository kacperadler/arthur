# AR0601 - Outcome

- Merged: 2026-11-01, `290e014e`
- Branch: arthur/2026-11-01-worker-8b02a88b
- Reviews: review-1.md PASS
- Cost: worker $2.13, reviews $0.38; review rounds 1

## What went in

- README.md: a dokploy Features line (partly built: reads; upload and deploy planned; link to its doc); dokploy's writes in the Planned line; the small diagram's delivery node names dokploy and is light green (partly built).
- docs/setup.md: step 5 names both channels and adds a paragraph on dokploy: what it does, its `instances` and variables, the project's `dokploy.project(...)`, and its setup page.
- docs/architecture/core-and-plugins.mmd: a dokploy node among the projects and trackers, an arrow to the Dokploy servers, and dokploy in the first-version class.
- docs/architecture/versions.mmd: the second first-version node names dokploy, its reads built and upload and deploy to come.
- spec/vision.md: a `dokploy (named) | first` row in the plugins table with its setup page, and Dokploy servers among the plugins with named instances.
- spec/roadmap.md: entry 1's Delivers and Done means give the three zones (green, yellow, red, above 250) as the styleguide does.
- arthur.mmd: the date line and the legend say 2026-11-01; line 3 adds listen 81, video 102, projects 103 and dokploy's state.
- spec/features/AR0601-docs-catch-up-dokploy-in-the-readme-setup-guide-architecture-diagram-and-vision/findings.md: F1, no uptime node in core-and-plugins.mmd.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1385/1454 passed.

## Left open

- Deferred (client summary): F1. core-and-plugins.mmd has no uptime node
