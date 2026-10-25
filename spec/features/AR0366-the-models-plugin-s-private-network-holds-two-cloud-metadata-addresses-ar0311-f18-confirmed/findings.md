# AR0366 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. `fd00:ec2::254` is not listed in machines

- Kind: test
- Found by: 2026-10-25-review-dafb690c (reviewer, non-blocking note), 2026-10-25
- Where: `packages/machines/src/machine-check.ts:37`
- What: Done means said the same two; the address is outside machines' private IPv6 ranges, so already refused as public.
- Status: dropped (a line that never matches; the ticket's Out excludes it)

## F2. A name resolving to a metadata address is refused as "a public address"

- Kind: test
- Found by: 2026-10-25-review-dafb690c (reviewer, non-blocking note), 2026-10-25
- Where: `packages/models/src/models.ts:35`
- What: The wording is inexact; the refusal holds.
- Status: dropped (the refusal is right; a wording change is the owner's call, not worth a ticket alone)

## F3. The probe path has no test for the metadata address

- Kind: test
- Found by: 2026-10-25-review-dafb690c (reviewer, non-blocking note), 2026-10-25
- Where: `packages/models/src/probe.ts:59`
- What: Same `isPrivate`; the probe's 30 s cache keeps a second address out of one test.
- Status: dropped (the shared `isPrivate` is tested; the ticket asked no probe test)

## F4. Statements joined to hold the line budget

- Kind: test
- Found by: 2026-10-25-review-dafb690c (reviewer, non-blocking note), 2026-10-25
- Where: `packages/machines/src/machine-check.ts:36`
- What: Two calls share a line.
- Status: dropped (style only)

## F5. Widening the IPv6 entry upward fails no test

- Kind: test
- Found by: 2026-10-25-review-dafb690c (reviewer, non-blocking note), 2026-10-25
- Where: `packages/models/src/model-options.ts`
- What: The accepted neighbour `fd00:ec2::253` sits below the address only.
- Status: dropped (minor; not a key behaviour)
