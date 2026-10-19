# AR0167 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

## F1. The resources scope test assumes a machine of 2 cores or more

- Kind: bug
- Found by: 2026-10-19-ar0167-be6531bc (worker), 2026-10-19
- Where: `packages/resources/test/resources.test.ts:75`
- What: "a job spawned with the plugin gets its caps on its own scope" sets `perJob.cpu` 1.5 and expects `CPUQuotaPerSecUSec` `1.500000s`; the core caps a job's CPU at the machine's cores, so on one core (`taskset -c 0 node --import @arthur/core/testing --test packages/resources/test/resources.test.ts`, with a systemd user manager) it gets `1s` and fails every time (12 of 12 runs). Not a flake: GitHub's runner has more cores.
- Suggestion: take the expected quota as `min(1.5, availableParallelism())`, or skip below 2 cores; nothing else changes.
- Status: open
