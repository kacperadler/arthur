# AR0717 - Outcome

- Merged: 2026-11-23, `f8b0149c`
- Branch: arthur/2026-11-23-worker-10684f84
- Reviews: review-1.md FAIL, review-2.md PASS
- Cost: worker $5.21, reviews $1.01; review rounds 2

## What went in

- spec/vision.md: the orchestration row says "Later, built: an agent per project with a `chat`…(roadmap 85 to 88)", and the line on the order of the later plugins says project agents came before all of them and are built; nothing else changed.
- spec/roadmap.md: the Order paragraph says project agents (85 to 88) came first and are built (AR0705 to AR0708), without the condition that the other projects move first.
- docs/architecture/versions.mmd: the `agents` node, still first under "Later, in this order", is labelled built and drawn in a new `built` class (green, dashed); the first-line comment names that class.
- docs/architecture/core-and-plugins.mmd: the `agents` node is labelled built and moves from the `later` class to a new `built` class (green, dashed); the first-line comment names that class.
- spec/features/AR0717-the-vision-still-says-project-agents-come-later/findings.md: new, with F1 (the vision's row, the two diagrams and the roadmap disagreed on which version project agents belong to), fixed in 3cd38605 on the owner's AR-D712.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1849/1920 passed.

## Left open

- Tickets from findings: none open.
