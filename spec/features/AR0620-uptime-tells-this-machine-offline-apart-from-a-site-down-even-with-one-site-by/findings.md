# AR0620 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the merge adds the passed review's notes of kind security, bug or risk. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. A probe named by a host name that resolves to loopback or a private address passes the load check and always answers

- Kind: fix
- Found by: 2026-11-04-review-4cdcae56 (review), 2026-11-04
- Where: `packages/uptime/src/uptime-options.ts:31`, `packages/uptime/src/site-check.ts:49`
- What: the load check refuses only IP literals in `PRIVATE` and `localhost` names; a DNS name whose address is 127.0.0.1 (or any private one) passes, and `probe` connects through plain `fetch`, without the `guarded` lookup a site's redirect uses, so such a probe answers locally and this machine is never taken as offline. The NAT64 form `[64:ff9b::7f00:1]` passes too, as `PRIVATE` holds no `64:ff9b::/96`, which also lets a redirect reach it.
- Suggestion: send each probe through `site-check.ts`'s `get` (node:https with the `guarded` lookup), so a probe whose name resolves to a `PRIVATE` address is refused at its connection as no answer; and add `64:ff9b::/96` to `PRIVATE`. Out: a DNS lookup at load.
- Status: open
