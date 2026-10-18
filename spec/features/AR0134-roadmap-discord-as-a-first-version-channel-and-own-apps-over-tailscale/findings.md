# AR0134 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

`- Budget:` is optional: set it, in USD, only when the ticket this finding becomes is expected to cost more than the autopilot default, and leave the line out otherwise. `h merge` copies it into the ticket's JSON block as `budget`, which `h ticket status --autopilot` passes to `--budget`, capped at `H_AUTOPILOT_BUDGET_MAX`.

## F1. The example config and two diagrams still call Discord later

- Kind: cleanup
- Found by: 2026-10-18-ar0134-d1d258df (worker), 2026-10-18
- Where: `arthur.config.example.ts:27` (`// later, named`), `docs/architecture/core-and-plugins.mmd:93` (`discord` in the `later` class), `docs/architecture/versions.mmd:20-25,33` (discord in the later chain `agents --> signal --> discord --> slack`).
- What: AR0134 moves Discord (roadmap 89, 90) into the first version and adds the owner's own apps over Tailscale (roadmap 95) in `spec/roadmap.md`, `spec/vision.md`, `README.md` and `arthur.mmd`; its Scope names only those four files, so these three still show Discord as a later plugin and have no node for the own apps. `spec/vision.md:3` and `README.md` link the two diagrams.
- Suggestion: mark `discord` first in the example config's import comment, move it to the `first` class in `core-and-plugins.mmd`, take it out of the later chain in `versions.mmd` (signal, slack, whatsapp, server) and add the own apps after server. No code changes.
- Status: ticket AR0151

## F2. Roadmap entry 93 depends on 41 but sits before it

- Kind: cleanup
- Found by: 2026-10-18-ar0134-d1d258df (worker), 2026-10-18
- Where: `spec/roadmap.md`, entry 93 (under `## Session`, after 80), `- Depends on:` naming 41, which sits later under `## Projects`.
- What: the roadmap says the coordinator starts an entry once everything in its "Depends on" is merged, in file order; 93 is listed before 41 but needs it, so the file order and the dependencies disagree. It was so before AR0134: a throwaway node script that walks the `### N.` headings and checks every number in `- Depends on:` against the entries above it printed `93 -> 41` on `git show HEAD:spec/roadmap.md` (main before this branch), and the same on this branch.
- Suggestion: either move 93 and 94 after 41, or say in the Order paragraph that 93 waits for 41 although listed before it. Roadmap text only.
- Status: ticket AR0152
