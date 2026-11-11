# AR0646 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the merge adds the passed review's notes of kind security, bug or risk. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. A slow `docker system df` can keep a machine's jobs from ever being cleaned

- Kind: fix
- Found by: 2026-11-11-worker-48cf9b11 (worker), 2026-11-11
- Where: `packages/docker/src/docker-cleanup.ts:25`
- What: the cleanup measures the space it freed with `docker system df` before and after, inside its two calls, cut after 30 s and 85 s. `docker system df` sums the size of every volume on the machine; on a machine with many or large volumes it may take longer than that [INFERENCE: not measured; the VPS runs three stacks of the owner's]. Then the listing call is cut, the hook gives up with a notice, and nothing of the job's is removed, at every prune, leaving it all to the sweep (entry 72).
- Suggestion: when `docker system df` fails or is cut, keep the removals and leave the space out of the line (run it in the background of each call with its own limit, or measure with `df -Pk` on Docker's data root, as W4's sweep plans to). Out: the order of the removals and their refusals.
- Status: open
