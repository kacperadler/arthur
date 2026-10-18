# AR0125 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

## F1. Plan and review jobs must name their ticket on a `Ticket:` line to be placed by its labels

- Kind: risk
- Found by: 2026-10-18-ar0125-machine-placement-7dd32646 (worker), 2026-10-18
- Where: `packages/machines/src/machine-place.ts` (`need`), roadmap entries 28 (plan kinds) and 52 (review)
- What: placement finds a job's ticket only through the `Ticket:` paths of its task (the core's `tickets`). The plan and plan-review kinds (entry 28) and the review kind (entry 52) are not built yet; a task of theirs that names the ticket another way (an id, a branch) is placed by its project's labels only, so a review of an iOS ticket whose labels sit in the ticket, not the project, may run on a machine without Xcode.
- Suggestion: entries 28 and 52 write `Ticket: spec/features/<id>-<slug>/ticket.md` into every task they spawn, with a test that such a job lands on the ticket's machine.
- Status: dropped (carried by roadmap entries 28 and 52's Done means)

## F2. `resources.free` answer shape fixed here for entry 34

- Kind: improvement
- Found by: 2026-10-18-ar0125-machine-placement-7dd32646 (worker), 2026-10-18
- Where: `packages/machines/src/machine-place.ts` (`placement`), `packages/machines/docs/commands/machines.md` ("Placing a job"), roadmap entry 34
- What: entry 31 reads "the most room from `call("resources.free")`" without its shape. Placement calls it once per candidate machine with the machine's name and reads the answer (or its promise) as a number: the jobs that machine has room for, the most winning. Entry 34 must provide exactly that, or placement silently compares `NaN` and falls back to `local` and the list's order.
- Suggestion: entry 34 provides `resources.free(machine) -> number` as documented, and its test spawns through the machines plugin's placement on the fake host to prove the two agree.
- Status: dropped (carried by roadmap entry 34's Done means)

## F3. `machine-place.ts`'s `FEATURE` regex is looser than `board-jobs.ts`'s

- Status: dropped (harmless: the path must already exist as a tracked file, checked before placement; review-1)
- Source: review-1.md

## F4. Placement reads `ticket.md` from the main checkout, so an uncommitted edit counts

- Status: dropped (the worker's call, accepted in the ticket's Decisions)
- Source: review-1.md

