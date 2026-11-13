# AR0646 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the merge adds the passed review's notes of kind security, bug or risk. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. A slow `docker system df` can keep a machine's jobs from ever being cleaned

- Kind: fix
- Found by: 2026-11-11-worker-48cf9b11 (worker), 2026-11-11
- Where: `packages/docker/src/docker-cleanup.ts:25`
- What: the cleanup measures the space it freed with `docker system df` before and after, inside its two calls, cut after 30 s and 85 s. `docker system df` sums the size of every volume on the machine; on a machine with many or large volumes it may take longer than that [INFERENCE: not measured; the VPS runs three stacks of the owner's]. Then the listing call is cut, the hook gives up with a notice, and nothing of the job's is removed, at every prune, leaving it all to the sweep (entry 72).
- Suggestion: when `docker system df` fails or is cut, keep the removals and leave the space out of the line (run it in the background of each call with its own limit, or measure with `df -Pk` on Docker's data root, as W4's sweep plans to). Out: the order of the removals and their refusals.
- Status: deferred (client summary)

## F2. no test catches the removal of the listing's error exit

- Kind: fix
- Found by: 2026-11-11-review-7afc2635 (review), 2026-11-11
- Where: `packages/docker/src/docker-cleanup.ts:24`
- What: I removed `|| exit` after each `docker $kind ... --format '{{json .}}'` and all 30 docker tests still passed. If one listing fails briefly while the later ones and `system df` succeed, that kind is silently skipped: the hook still succeeds, gives no notice, and the line leaves out what was not listed. If the daemon stays down, `system df` fails too and the hook still gives up, so the practical effect is narrow.
- Status: deferred (client summary)

## F3. images are removed by ID

- Kind: fix
- Found by: 2026-11-11-review-7afc2635 (review), 2026-11-11
- Where: `packages/docker/src/docker-cleanup.ts:86`
- What: An image the job built with two tags (`build -t shop:latest -t shop:1`) is refused by Docker ("image is referenced in multiple repositories", must be forced), so it is kept and named at every prune and waits for the sweep [INFERENCE from Docker's documented behaviour; not exercised by the fake].
- Status: ticket AR0702
