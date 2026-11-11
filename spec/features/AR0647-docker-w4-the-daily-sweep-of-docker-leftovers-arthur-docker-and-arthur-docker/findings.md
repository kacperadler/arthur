# AR0647 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the merge adds the passed review's notes of kind security, bug or risk. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. The vision still says the sweep removes unlabelled stopped containers and anonymous volumes

- Kind: docs
- Found by: 2026-11-11-worker-5f2781a0 (worker), 2026-11-11
- Where: `spec/vision.md:167`
- What: "The sweep" in the vision lists "stopped containers, unused networks, dangling images, unused anonymous volumes, build cache unused that long" as the unlabelled leftovers it removes. The owner approved AR0604's plan with every recommendation (AR-D520), which limits the unlabelled part to dangling images, unused networks and the build cache, so his own stopped stacks keep their containers and data; this branch builds that limit and states it in `packages/docker/docs/docker.md`, the roadmap's entry 72 and `arthur.config.example.ts`. The vision is the owner's, so the worker leaves its line as it is.
- Suggestion: the owner rewords the vision's sentence to the approved limit, for example "unlabelled leftovers older than `leftoverHours`: unused networks, dangling images, build cache unused that long; the owner's own stopped containers and volumes stay". Nothing else changes.
- Status: open
